import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, Logger } from '@nestjs/common';
import {
  type Notification,
  NotificationStatus,
  NotificationType,
  type Resident,
  type Round,
  type RoundStatus,
  type Society,
  type Vendor,
} from '@prisma/client';
import type { Job, Queue } from 'bullmq';
import { QueueEvents } from 'bullmq';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { NotificationDispatchProcessor } from '../src/modules/notifications/notification-dispatch.processor';
import { NotificationDispatchReconciler } from '../src/modules/notifications/notification-dispatch.reconciler';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_SEND_ATTEMPTS,
  type NotificationJobData,
  NotificationsService,
} from '../src/modules/notifications/notifications.service';
import { RoundReminderProcessor } from '../src/modules/rounds/round-reminder.processor';
import {
  REMINDER_LEAD_MS,
  ROUND_REMINDER_QUEUE,
  RoundReminderScheduler,
  reminderJobId,
} from '../src/modules/rounds/round-reminder.scheduler';
import { RoundsAdminService } from '../src/modules/rounds/rounds-admin.service';
import { RoundsService } from '../src/modules/rounds/rounds.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Notification outbox end-to-end (FEAT-006, ADR-0013). Proves, against real
 * Postgres + Redis:
 *  - every lifecycle event stages exactly one row per recipient, INSIDE the
 *    transaction that caused it (a rejected join stages nothing);
 *  - the unique dedupe key makes re-closing, re-staging and duplicate dispatch
 *    all no-ops — a resident can never be told the same thing twice;
 *  - dispatch → processor → SENT delivers through the NotificationChannel, and a
 *    provider failure records attempts and ends as FAILED, never as a lost row;
 *  - the boot reconciler re-dispatches an orphaned PENDING row;
 *  - the "closing soon" reminder fires as a real BullMQ delayed job, fans out to
 *    the participants that exist AT FIRE TIME, and no-ops on a closed round.
 */
describe('Notifications outbox (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let channel: CapturingChannel;
  let notifications: NotificationsService;
  let rounds: RoundsService;
  let adminRounds: RoundsAdminService;
  let dispatchProcessor: NotificationDispatchProcessor;
  let reconciler: NotificationDispatchReconciler;
  let reminderScheduler: RoundReminderScheduler;
  let reminderProcessor: RoundReminderProcessor;
  let sendQueue: Queue;
  let reminderQueue: Queue;
  let reminderEvents: QueueEvents;

  let society: Society;
  let alice: Resident;
  let bob: Resident;
  let aliceToken: string;
  let vendor: Vendor;
  const serviceIds: string[] = [];
  const suffix = randomInviteCode().toLowerCase();

  // Lowest threshold 5 → "met" iff unitsCount >= 5.
  const TIERS = [
    { threshold: 5, price: 900 },
    { threshold: 10, price: 700 },
  ];

  /** A round on its own fresh service (sidesteps the one-OPEN-per-service index). */
  const createRound = async (
    status: RoundStatus = 'OPEN',
    unitsCount = 0,
    deadline = new Date(Date.now() + 60 * 60 * 1_000),
  ): Promise<Round> => {
    const service = await prisma.service.create({
      data: {
        name: `Notify ${serviceIds.length}`,
        slug: `nt-${serviceIds.length}-${suffix}`,
        description: 'x',
        category: 'Home',
        active: true,
      },
    });
    serviceIds.push(service.id);
    return prisma.round.create({
      data: {
        societyId: society.id,
        serviceId: service.id,
        status,
        unitsCount,
        deadline,
        tiers: { create: TIERS },
      },
    });
  };

  /** Add a participant directly (bypassing join, so no confirmation is staged). */
  const addParticipant = async (round: Round, resident: Resident, units: number): Promise<void> => {
    await prisma.roundParticipant.create({ data: { roundId: round.id, residentId: resident.id, units } });
    await prisma.round.update({
      where: { id: round.id },
      data: { unitsCount: { increment: units } },
    });
  };

  /** Every round this suite created (its services are the marker). */
  const createdRoundIds = async (): Promise<string[]> =>
    (await prisma.round.findMany({ where: { serviceId: { in: serviceIds } }, select: { id: true } })).map(
      (r) => r.id,
    );

  const rowsFor = (roundId: string, type?: NotificationType): Promise<Notification[]> =>
    prisma.notification.findMany({
      where: { roundId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'asc' },
    });

  /**
   * Stage a row WITHOUT dispatching it. Backend suites run in parallel against
   * one shared Redis, so any app's send worker may consume a job the moment it
   * is queued; delivery assertions therefore stage directly and run the
   * processor by hand, which is both deterministic and closer to a unit test of
   * the processor's contract.
   */
  const stageDirect = async (roundId: string, resident: Resident): Promise<Notification> => {
    const [id] = await prisma.$transaction((tx) =>
      notifications.stage(tx, [
        {
          residentId: resident.id,
          roundId,
          type: NotificationType.ROUND_DELIVERED,
          dedupeKey: `test:${randomInviteCode()}`,
          body: 'BulkSaving: test body',
        },
      ]),
    );
    return prisma.notification.findUniqueOrThrow({ where: { id } });
  };

  /**
   * Remove a queued job if it is still removable. Parallel suites share Redis, so
   * another app's worker may already hold the lock — that is cleanup noise, never
   * a failure of what the test asserts.
   */
  const tryRemoveJob = async (queue: Queue, jobId: string): Promise<void> => {
    try {
      await (await queue.getJob(jobId))?.remove();
    } catch {
      // Locked by a worker that is processing it — it will complete and clear itself.
    }
  };

  /** Run the send processor for one row, as BullMQ would. */
  const runSend = (
    notificationId: string,
    attemptsMade = 0,
    attempts = NOTIFICATION_SEND_ATTEMPTS,
  ): ReturnType<NotificationDispatchProcessor['process']> =>
    dispatchProcessor.process({
      data: { notificationId },
      opts: { attempts },
      attemptsMade,
    } as Job<NotificationJobData>);

  /** The unmocked `stage`, kept so a test can stage for real and then throw. */
  let realStage: NotificationsService['stage'];

  beforeAll(async () => {
    channel = new CapturingChannel();
    app = await createTestApp(channel);
    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);
    realStage = notifications.stage.bind(notifications);
    rounds = app.get(RoundsService);
    adminRounds = app.get(RoundsAdminService);
    dispatchProcessor = app.get(NotificationDispatchProcessor);
    reconciler = app.get(NotificationDispatchReconciler);
    reminderScheduler = app.get(RoundReminderScheduler);
    reminderProcessor = app.get(RoundReminderProcessor);
    sendQueue = app.get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE));
    reminderQueue = app.get<Queue>(getQueueToken(ROUND_REMINDER_QUEUE));

    // Our own send worker stays paused for the whole suite: every delivery here
    // is driven explicitly through `runSend`, so nothing is processed behind the
    // assertions' back. The reminder worker stays ACTIVE — the delayed-job test
    // needs it.
    await dispatchProcessor.worker.pause();

    reminderEvents = new QueueEvents(ROUND_REMINDER_QUEUE, {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      },
    });
    await reminderEvents.waitUntilReady();

    society = await prisma.society.create({
      data: { name: 'Notify Society', city: 'Pune', inviteCode: randomInviteCode() },
    });
    alice = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), name: 'Alice', verifiedAt: new Date() },
    });
    bob = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), name: 'Bob', verifiedAt: new Date() },
    });
    aliceToken = (await app.get(AuthService).issueTokens(alice)).accessToken;
    vendor = await prisma.vendor.create({ data: { name: 'CoolAir Services', phone: randomPhone() } });
  });

  afterEach(() => {
    channel.messages = [];
    channel.failSends = false;
  });

  afterAll(async () => {
    await reminderEvents.close();
    // Remove any jobs this suite queued, so nothing is left pointing at rows we
    // are about to delete (a leaked job would be a no-op, but not a clean exit).
    const queued = await prisma.notification.findMany({
      where: { roundId: { in: await createdRoundIds() } },
      select: { id: true },
    });
    for (const { id } of queued) {
      await tryRemoveJob(sendQueue, id);
    }
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    // Notifications cascade from their round/resident; residents cascade from the society.
    await prisma.society.delete({ where: { id: society.id } });
    await prisma.vendor.delete({ where: { id: vendor.id } });
    await app.close();
  });

  describe('staging — join', () => {
    it('stages exactly one confirmation, keyed on the participant row', async () => {
      const round = await createRound();

      await request(app.getHttpServer())
        .post(`/rounds/${round.id}/join`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ units: 2 })
        .expect(201);

      const staged = await rowsFor(round.id);
      expect(staged).toHaveLength(1);
      expect(staged[0]).toMatchObject({
        residentId: alice.id,
        type: NotificationType.ROUND_JOINED,
      });
      const participant = await prisma.roundParticipant.findFirstOrThrow({
        where: { roundId: round.id, residentId: alice.id },
      });
      expect(staged[0].dedupeKey).toBe(`ROUND_JOINED:${participant.id}`);
      expect(staged[0].body).toContain('2 units');
      expect(staged[0].body).not.toContain(alice.phone);
    });

    it('does not re-confirm when an existing pledge is changed', async () => {
      const round = await createRound();
      await rounds.join(round.id, society.id, alice.id, 1);
      await rounds.join(round.id, society.id, alice.id, 4);
      await rounds.updatePledge(round.id, society.id, alice.id, 6);

      expect(await rowsFor(round.id)).toHaveLength(1);
    });

    it('confirms again after a leave and rejoin (a genuinely new pledge)', async () => {
      const round = await createRound();
      await rounds.join(round.id, society.id, alice.id, 2);
      await rounds.leave(round.id, society.id, alice.id);
      await rounds.join(round.id, society.id, alice.id, 3);

      const staged = await rowsFor(round.id);
      expect(staged).toHaveLength(2);
      expect(new Set(staged.map((n) => n.dedupeKey)).size).toBe(2);
    });

    it('stages NOTHING when the join is rejected (staging is inside the transaction)', async () => {
      const round = await createRound('CLOSED_MET');

      await request(app.getHttpServer())
        .post(`/rounds/${round.id}/join`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ units: 2 })
        .expect(409);

      expect(await rowsFor(round.id)).toHaveLength(0);
    });
  });

  describe('staging — round-wide events', () => {
    it('CLOSED_MET: one row per participant, and a re-close stages nothing new', async () => {
      const round = await createRound('OPEN', 0, new Date(Date.now() - 1_000));
      await addParticipant(round, alice, 3);
      await addParticipant(round, bob, 2);

      await rounds.closeRound(round.id);
      const first = await rowsFor(round.id, NotificationType.ROUND_CLOSED_MET);
      expect(first).toHaveLength(2);
      expect(new Set(first.map((n) => n.residentId))).toEqual(new Set([alice.id, bob.id]));
      expect(first[0].body).toContain('Target reached');

      // Idempotent re-close: no second message for anyone.
      await rounds.closeRound(round.id);
      expect(await rowsFor(round.id, NotificationType.ROUND_CLOSED_MET)).toHaveLength(2);
    });

    it('CLOSED_EXPIRED: tells participants there is nothing to pay', async () => {
      const round = await createRound('OPEN', 0, new Date(Date.now() - 1_000));
      await addParticipant(round, alice, 1);

      await rounds.closeRound(round.id);
      const staged = await rowsFor(round.id, NotificationType.ROUND_CLOSED_EXPIRED);
      expect(staged).toHaveLength(1);
      expect(staged[0].body).toContain('nothing to pay');
    });

    it('a round with no participants stages nothing', async () => {
      const round = await createRound('OPEN', 0, new Date(Date.now() - 1_000));
      await rounds.closeRound(round.id);
      expect(await rowsFor(round.id)).toHaveLength(0);
    });

    it('ASSIGNED quotes the vendor and the amount due; DELIVERED follows', async () => {
      const round = await createRound('CLOSED_MET', 6);
      await addParticipant(round, alice, 2);

      await rounds.assign(round.id, vendor.id, 700);
      const assigned = await rowsFor(round.id, NotificationType.ROUND_ASSIGNED);
      expect(assigned).toHaveLength(1);
      expect(assigned[0].body).toContain('CoolAir Services');
      expect(assigned[0].body).toContain('₹1400'); // 2 units × ₹700

      await rounds.deliver(round.id);
      expect(await rowsFor(round.id, NotificationType.ROUND_DELIVERED)).toHaveLength(1);
    });

    it('a rejected assign stages nothing', async () => {
      const round = await createRound('OPEN', 6);
      await addParticipant(round, alice, 2);

      await expect(rounds.assign(round.id, vendor.id, 700)).rejects.toThrow();
      expect(await rowsFor(round.id)).toHaveLength(0);
    });

    it('CANCELLED notifies every participant', async () => {
      const round = await createRound('CLOSED_MET', 6);
      await addParticipant(round, alice, 2);
      await addParticipant(round, bob, 4);

      await rounds.cancel(round.id);
      const staged = await rowsFor(round.id, NotificationType.ROUND_CANCELLED);
      expect(staged).toHaveLength(2);
      expect(staged[0].body).toContain('cancelled');
    });
  });

  describe('dispatch + delivery', () => {
    it('delivers a staged row through the channel and marks it SENT', async () => {
      const round = await createRound();
      const row = await stageDirect(round.id, alice);

      const result = await runSend(row.id);

      expect(result).toEqual({ sent: true });
      expect(channel.messagesTo(alice.phone)).toEqual([row.body]);
      const after = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe(NotificationStatus.SENT);
      expect(after.sentAt).not.toBeNull();
      expect(after.attempts).toBe(1);
    });

    it('a real join DISPATCHES the row it staged (the stage → queue link)', async () => {
      // V2 P1: without this, deleting the dispatch call in RoundsService would
      // leave the whole suite green while no resident ever got an SMS. A spy is
      // used rather than reading the queue back, because parallel suites share
      // Redis and a live worker elsewhere can consume the job mid-assertion.
      const round = await createRound();
      const dispatch = jest.spyOn(notifications, 'dispatch');

      await rounds.join(round.id, society.id, alice.id, 2);

      const [row] = await rowsFor(round.id);
      expect(dispatch).toHaveBeenCalledWith([row.id]);
      // …and the job carries the row id as its jobId, so a re-dispatch dedupes.
      const add = await sendQueue.getJob(row.id);
      expect(add === undefined || add.data.notificationId === row.id).toBe(true);
      dispatch.mockRestore();
      await tryRemoveJob(sendQueue, row.id);
    });

    it('a close that throws AFTER staging leaves no row behind (true rollback)', async () => {
      // The other "stages nothing" tests are rejected BEFORE staging runs, so
      // they prove ordering, not rollback (V2 P2-6). This one stages first and
      // then forces the transaction to fail.
      const round = await createRound('OPEN', 0, new Date(Date.now() - 1_000));
      await addParticipant(round, alice, 3);
      const boom = jest.spyOn(notifications, 'stage').mockImplementation(async (tx, rows) => {
        const ids = await realStage.call(notifications, tx, rows);
        expect(ids.length).toBeGreaterThan(0); // rows really were written in-tx
        throw new Error('forced failure after staging');
      });

      await expect(rounds.closeRound(round.id)).rejects.toThrow('forced failure after staging');

      boom.mockRestore();
      expect(await rowsFor(round.id)).toHaveLength(0);
      // …and the round itself rolled back with it.
      expect((await prisma.round.findUniqueOrThrow({ where: { id: round.id } })).status).toBe('OPEN');
    });

    it('logs the recipient only as a redacted phone number', async () => {
      const round = await createRound();
      const row = await stageDirect(round.id, alice);
      const logged: string[] = [];
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation((message) => {
        logged.push(String(message));
      });

      await runSend(row.id);

      logSpy.mockRestore();
      const ours = logged.filter((line) => line.includes(row.id));
      expect(ours.length).toBeGreaterThan(0);
      for (const line of ours) {
        expect(line).not.toContain(alice.phone);
        expect(line).toContain(alice.phone.slice(-4));
        expect(line).toContain('X');
      }
    });

    it('a duplicate job for an already-sent row sends nothing a second time', async () => {
      const round = await createRound();
      const row = await stageDirect(round.id, alice);

      await runSend(row.id);
      const second = await runSend(row.id);

      expect(second).toEqual({ sent: false, reason: 'already-terminal' });
      expect(channel.messagesTo(alice.phone)).toHaveLength(1);
    });

    it('records the attempt and rethrows on a provider failure, staying PENDING mid-retry', async () => {
      const round = await createRound();
      const row = await stageDirect(round.id, alice);
      channel.failSends = true;

      await expect(runSend(row.id, 0)).rejects.toThrow('provider unavailable');

      const after = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe(NotificationStatus.PENDING);
      expect(after.attempts).toBe(1);
      expect(after.lastError).toContain('provider unavailable');
    });

    it('moves the row to FAILED (never silently dropped) on the final attempt', async () => {
      const round = await createRound();
      const row = await stageDirect(round.id, alice);
      channel.failSends = true;

      await expect(runSend(row.id, NOTIFICATION_SEND_ATTEMPTS - 1)).rejects.toThrow();

      const after = await prisma.notification.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe(NotificationStatus.FAILED);
      expect(after.attempts).toBe(NOTIFICATION_SEND_ATTEMPTS);
      expect(after.lastError).toContain('provider unavailable');
    });

    it('retries a row it cannot find, then no-ops on the last attempt', async () => {
      await expect(runSend('does-not-exist', 0)).rejects.toThrow('not found');
      expect(await runSend('does-not-exist', NOTIFICATION_SEND_ATTEMPTS - 1)).toEqual({
        sent: false,
        reason: 'not-found',
      });
    });

    it('re-staging the same dedupe key stages nothing new and never double-sends', async () => {
      const round = await createRound();
      const row = await prisma.notification.findUniqueOrThrow({
        where: { id: (await stageDirect(round.id, alice)).id },
      });

      const again = await prisma.$transaction((tx) =>
        notifications.stage(tx, [
          {
            residentId: alice.id,
            roundId: round.id,
            type: NotificationType.ROUND_DELIVERED,
            dedupeKey: row.dedupeKey,
            body: 'a different body that must never be sent',
          },
        ]),
      );

      expect(again).toEqual([row.id]);
      expect(await rowsFor(round.id)).toHaveLength(1);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).body).toBe(row.body);
    });

    it('dispatch never throws when the queue is unavailable — the row stays PENDING', async () => {
      const round = await createRound();
      const row = await stageDirect(round.id, alice);
      const add = jest
        .spyOn(sendQueue, 'add')
        .mockRejectedValue(new Error('redis is down') as never);

      await expect(notifications.dispatch([row.id])).resolves.toBeUndefined();

      expect(add).toHaveBeenCalledTimes(1);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).status).toBe(
        NotificationStatus.PENDING,
      );
      add.mockRestore();
    });

    it('the boot reconciler re-dispatches a PENDING row whose job is gone', async () => {
      const round = await createRound();
      const row = await stageDirect(round.id, alice); // staged, never dispatched
      const dispatch = jest.spyOn(notifications, 'dispatch');

      const count = await reconciler.reconcile([row.id]);

      expect(count).toBe(1);
      expect(dispatch).toHaveBeenCalledWith([row.id]);
      dispatch.mockRestore();
      await tryRemoveJob(sendQueue, row.id);
    });

    it('the reconciler leaves a row that already has a live job alone', async () => {
      const round = await createRound();
      const row = await stageDirect(round.id, alice);
      // A long delay keeps the job pending, so no worker (here or in a parallel
      // suite) can consume it before the assertion.
      await sendQueue.add(
        'send-notification',
        { notificationId: row.id },
        { jobId: row.id, delay: 60_000 },
      );

      expect(await reconciler.reconcile([row.id])).toBe(0);

      await tryRemoveJob(sendQueue, row.id);
    });
  });

  describe('closing-soon reminder', () => {
    it('computes a delay of exactly one lead time before the deadline', () => {
      const now = new Date('2026-09-17T00:00:00.000Z');
      const deadline = new Date(now.getTime() + 3 * REMINDER_LEAD_MS);
      expect(RoundReminderScheduler.delayFor(deadline, now)).toBe(2 * REMINDER_LEAD_MS);
    });

    it('schedules no reminder when the whole window is shorter than the lead', async () => {
      const round = await createRound('OPEN', 0, new Date(Date.now() + 60 * 60 * 1_000));
      expect(await reminderScheduler.schedule(round.id, round.deadline)).toBe(false);
      expect(await reminderQueue.getJob(reminderJobId(round.id))).toBeUndefined();
    });

    it('opening a round schedules a reminder, and closing it removes the job', async () => {
      const service = await prisma.service.create({
        data: {
          name: `Notify reminder ${suffix}`,
          slug: `nt-rem-${suffix}`,
          description: 'x',
          category: 'Home',
          active: true,
        },
      });
      serviceIds.push(service.id);
      await prisma.serviceOffering.create({
        data: { societyId: society.id, serviceId: service.id, enabled: true },
      });

      const dto = await adminRounds.createRound(
        {
          societyId: society.id,
          serviceId: service.id,
          deadline: new Date(Date.now() + 3 * REMINDER_LEAD_MS).toISOString(),
          tiers: TIERS,
        },
        alice.id,
      );

      expect(await reminderQueue.getJob(reminderJobId(dto.id))).toBeDefined();
      await adminRounds.close(dto.id, alice.id);
      expect(await reminderQueue.getJob(reminderJobId(dto.id))).toBeUndefined();
    });

    it('cancelling a round also removes its pending reminder', async () => {
      const service = await prisma.service.create({
        data: {
          name: `Notify cancel ${suffix}`,
          slug: `nt-cancel-${suffix}`,
          description: 'x',
          category: 'Home',
          active: true,
        },
      });
      serviceIds.push(service.id);
      await prisma.serviceOffering.create({
        data: { societyId: society.id, serviceId: service.id, enabled: true },
      });

      const dto = await adminRounds.createRound(
        {
          societyId: society.id,
          serviceId: service.id,
          deadline: new Date(Date.now() + 3 * REMINDER_LEAD_MS).toISOString(),
          tiers: TIERS,
        },
        alice.id,
      );
      expect(await reminderQueue.getJob(reminderJobId(dto.id))).toBeDefined();

      await adminRounds.cancel(dto.id, alice.id);

      expect(await reminderQueue.getJob(reminderJobId(dto.id))).toBeUndefined();
    });

    it('fans out at FIRE time to the participants that exist then (real delayed job)', async () => {
      // Deadline just over one lead time away → the reminder fires in ~1.5s.
      const round = await createRound('OPEN', 0, new Date(Date.now() + REMINDER_LEAD_MS + 1_500));
      await reminderScheduler.schedule(round.id, round.deadline);
      // Alice joins AFTER the job was scheduled — she must still be reminded.
      await rounds.join(round.id, society.id, alice.id, 3);

      await reminderEvents.waitUntilReady();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('reminder job never completed')), 15_000);
        const done = (args: { jobId: string }): void => {
          if (args.jobId === reminderJobId(round.id)) {
            clearTimeout(timer);
            reminderEvents.off('completed', done);
            resolve();
          }
        };
        reminderEvents.on('completed', done);
      });

      const staged = await rowsFor(round.id, NotificationType.ROUND_CLOSING_SOON);
      expect(staged).toHaveLength(1);
      expect(staged[0].residentId).toBe(alice.id);
      expect(staged[0].body).toContain('3 of 5 units pledged');
    }, 30_000);

    it('no-ops (and stages nothing) once the round is no longer OPEN', async () => {
      const round = await createRound('CLOSED_MET', 6);
      await addParticipant(round, alice, 2);

      const result = await reminderProcessor.process({
        data: { roundId: round.id },
        opts: { attempts: 1 },
        attemptsMade: 0,
      } as Job<{ roundId: string }>);

      expect(result).toEqual({ notified: 0 });
      expect(await rowsFor(round.id, NotificationType.ROUND_CLOSING_SOON)).toHaveLength(0);
    });

    it('reports a missing round as gone on the final attempt', async () => {
      const result = await reminderProcessor.process({
        data: { roundId: 'nope' },
        opts: { attempts: 1 },
        attemptsMade: 0,
      } as Job<{ roundId: string }>);
      expect(result).toEqual({ notified: null });
    });
  });
});
