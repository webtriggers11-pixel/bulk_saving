import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { QueueEvents } from 'bullmq';
import request from 'supertest';
import type { Resident, Round, RoundStatus, Society, Vendor } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { RoundCloserProcessor, type RoundCloserJobResult } from '../src/modules/rounds/round-closer.processor';
import { RoundClosingReconciler } from '../src/modules/rounds/round-closing.reconciler';
import {
  ROUND_CLOSING_ATTEMPTS,
  ROUND_CLOSING_QUEUE,
  RoundClosingScheduler,
  type RoundClosingJobData,
} from '../src/modules/rounds/round-closing.scheduler';
import { RoundsService } from '../src/modules/rounds/rounds.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Round lifecycle + deadline scheduler (FEAT-004 T5, ADR-0011). Proves, against
 * real Postgres + Redis:
 *  - the RoundCloserProcessor closes an OPEN round to CLOSED_MET (units >= lowest
 *    threshold) or CLOSED_EXPIRED, and no-ops idempotently on non-OPEN / missing rounds;
 *  - a real BullMQ delayed job with a near-immediate deadline fires and closes the
 *    round (no real-minutes wait);
 *  - join/update/leave on CLOSED_MET / CLOSED_EXPIRED / CANCELLED → 409 ROUND_CLOSED;
 *  - scheduling is idempotent with retries, and the boot reconciler re-ensures jobs;
 *  - the guarded ASSIGNED → DELIVERED → RATED moves, and illegal jumps → 409.
 */
describe('Round lifecycle + scheduler (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rounds: RoundsService;
  let processor: RoundCloserProcessor;
  let scheduler: RoundClosingScheduler;
  let queueEvents: QueueEvents;
  let queue: Queue;
  let society: Society;
  let resident: Resident;
  let token: string;
  let vendor: Vendor | undefined; // FEAT-005: assign now requires an active vendor
  const serviceIds: string[] = [];
  const suffix = randomInviteCode().toLowerCase();

  // Lowest threshold = 5 → "met" iff unitsCount >= 5.
  const TIERS = [
    { threshold: 5, price: 900 },
    { threshold: 10, price: 700 },
  ];

  /** A round on its own fresh service (sidesteps the one-OPEN-per-service index). */
  const createRound = async (
    status: RoundStatus,
    unitsCount = 0,
    deadline = new Date(Date.now() - 1_000),
    societyId = society.id,
  ): Promise<Round> => {
    const service = await prisma.service.create({
      data: {
        name: `Lifecycle ${serviceIds.length}`,
        slug: `lc-${serviceIds.length}-${suffix}`,
        description: 'x',
        category: 'Home',
        active: true,
      },
    });
    serviceIds.push(service.id);
    return prisma.round.create({
      data: { societyId, serviceId: service.id, status, unitsCount, deadline, tiers: { create: TIERS } },
    });
  };

  const statusOf = async (id: string): Promise<RoundStatus> =>
    (await prisma.round.findUniqueOrThrow({ where: { id } })).status;

  const runJob = (roundId: string): Promise<RoundCloserJobResult> =>
    processor.process({ data: { roundId }, opts: {}, attemptsMade: 0 } as Job<RoundClosingJobData>);

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    rounds = app.get(RoundsService);
    processor = app.get(RoundCloserProcessor);
    scheduler = app.get(RoundClosingScheduler);
    queue = app.get<Queue>(getQueueToken(ROUND_CLOSING_QUEUE));

    queueEvents = new QueueEvents(ROUND_CLOSING_QUEUE, {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      },
    });
    await queueEvents.waitUntilReady();

    society = await prisma.society.create({
      data: { name: 'Lifecycle Society', city: 'Pune', inviteCode: randomInviteCode() },
    });
    resident = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), verifiedAt: new Date() },
    });
    token = (await app.get(AuthService).issueTokens(resident)).accessToken;
  });

  afterAll(async () => {
    await queueEvents.close();
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await prisma.society.delete({ where: { id: society.id } });
    // Rounds referencing the vendor are gone (Restrict FK), so the vendor can go too.
    if (vendor) {
      await prisma.vendor.delete({ where: { id: vendor.id } });
    }
    await app.close();
  });

  describe('RoundCloserProcessor', () => {
    it('OPEN with units >= lowest threshold → CLOSED_MET', async () => {
      const round = await createRound('OPEN', 5);
      expect(await runJob(round.id)).toEqual({ status: 'CLOSED_MET' });
      expect(await statusOf(round.id)).toBe('CLOSED_MET');
    });

    it('OPEN with units below the lowest threshold → CLOSED_EXPIRED', async () => {
      const round = await createRound('OPEN', 4);
      expect(await runJob(round.id)).toEqual({ status: 'CLOSED_EXPIRED' });
      expect(await statusOf(round.id)).toBe('CLOSED_EXPIRED');
    });

    it.each<RoundStatus>(['CLOSED_MET', 'CLOSED_EXPIRED', 'CANCELLED', 'ASSIGNED'])(
      'idempotent no-op on an already-%s round',
      async (status) => {
        const round = await createRound(status, 7);
        expect(await runJob(round.id)).toEqual({ status });
        expect(await statusOf(round.id)).toBe(status);
      },
    );

    it('missing round: throws to retry (maybe uncommitted), no-op on the final attempt', async () => {
      const attempt = (attemptsMade: number): Promise<RoundCloserJobResult> =>
        processor.process({
          data: { roundId: 'does-not-exist' },
          opts: { attempts: ROUND_CLOSING_ATTEMPTS },
          attemptsMade,
        } as Job<RoundClosingJobData>);
      await expect(attempt(0)).rejects.toThrow(/not found/);
      await expect(attempt(ROUND_CLOSING_ATTEMPTS - 2)).rejects.toThrow(/not found/);
      expect(await attempt(ROUND_CLOSING_ATTEMPTS - 1)).toEqual({ status: null });
    });

    it('a double-fire (two concurrent close jobs) settles on one terminal state', async () => {
      const round = await createRound('OPEN', 6);
      const results = await Promise.all([runJob(round.id), runJob(round.id)]);
      expect(results).toEqual([{ status: 'CLOSED_MET' }, { status: 'CLOSED_MET' }]);
      expect(await statusOf(round.id)).toBe('CLOSED_MET');
    });
  });

  describe('real BullMQ delayed job', () => {
    it('a near-immediate deadline job fires and auto-closes the round (met)', async () => {
      const round = await createRound('OPEN', 10, new Date(Date.now() + 300));
      await scheduler.schedule(round.id, round.deadline);
      const finished = new Promise<unknown>((resolve, reject) => {
        const onCompleted = ({ jobId, returnvalue }: { jobId: string; returnvalue: unknown }): void => {
          if (jobId === round.id) {
            clearTimeout(timer);
            queueEvents.off('completed', onCompleted);
            resolve(returnvalue);
          }
        };
        const timer = setTimeout(() => {
          queueEvents.off('completed', onCompleted);
          reject(new Error('close job did not complete in time'));
        }, 15_000);
        queueEvents.on('completed', onCompleted);
      });
      expect(await finished).toEqual({ status: 'CLOSED_MET' });
      expect(await statusOf(round.id)).toBe('CLOSED_MET');
    });

    it('a cancelled job never fires (round stays OPEN)', async () => {
      const round = await createRound('OPEN', 10, new Date(Date.now() + 500));
      await scheduler.schedule(round.id, round.deadline);
      await scheduler.cancel(round.id);
      expect(await queue.getJob(round.id)).toBeUndefined();
      await new Promise((r) => setTimeout(r, 1_500));
      expect(await statusOf(round.id)).toBe('OPEN');
      // Cleanup so the next assertion set can't be affected by this OPEN round.
      await rounds.cancel(round.id);
    });

    it('schedule() is idempotent and retries with backoff', async () => {
      const round = await createRound('OPEN', 0, new Date(Date.now() + 86_400_000));
      await scheduler.schedule(round.id, round.deadline);
      await scheduler.schedule(round.id, round.deadline);
      const job = await queue.getJob(round.id);
      expect(await job?.getState()).toBe('delayed');
      expect(job?.opts.attempts).toBe(ROUND_CLOSING_ATTEMPTS);
      expect(job?.opts.backoff).toEqual({ type: 'exponential', delay: 1_000 });
      expect((await queue.getDelayed()).filter((j) => j.id === round.id)).toHaveLength(1);
      await scheduler.cancel(round.id);
      await rounds.cancel(round.id);
    });

    it('reconciler ensures a job for OPEN rounds lacking one; past-deadline ones close promptly', async () => {
      const other = await prisma.society.create({
        data: { name: 'Reconcile Society', city: 'Pune', inviteCode: randomInviteCode() },
      });
      try {
        const future = await createRound('OPEN', 0, new Date(Date.now() + 86_400_000), other.id);
        const overdue = await createRound('OPEN', 5, new Date(Date.now() - 60_000), other.id);
        await createRound('CLOSED_EXPIRED', 0, new Date(Date.now() + 86_400_000), other.id);
        expect(await queue.getJob(future.id)).toBeUndefined();

        expect(await app.get(RoundClosingReconciler).reconcile(other.id)).toBe(2);
        expect(await (await queue.getJob(future.id))?.getState()).toBe('delayed');

        const giveUpAt = Date.now() + 15_000;
        while ((await statusOf(overdue.id)) === 'OPEN' && Date.now() < giveUpAt) {
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(await statusOf(overdue.id)).toBe('CLOSED_MET');
        await scheduler.cancel(future.id);
      } finally {
        await prisma.society.delete({ where: { id: other.id } });
      }
    });
  });

  describe('join interaction on closed-family statuses', () => {
    it.each<RoundStatus>(['CLOSED_MET', 'CLOSED_EXPIRED', 'CANCELLED'])(
      'join / update / leave on a %s round → 409 ROUND_CLOSED',
      async (status) => {
        const round = await createRound(status, 0, new Date(Date.now() + 86_400_000));
        const server = app.getHttpServer();
        const auth = `Bearer ${token}`;

        const join = await request(server).post(`/rounds/${round.id}/join`).set('Authorization', auth).send({ units: 2 }).expect(409);
        expect(join.body.error.code).toBe(ErrorCode.ROUND_CLOSED);
        const patch = await request(server).patch(`/rounds/${round.id}/join`).set('Authorization', auth).send({ units: 3 }).expect(409);
        expect(patch.body.error.code).toBe(ErrorCode.ROUND_CLOSED);
        const del = await request(server).delete(`/rounds/${round.id}/join`).set('Authorization', auth).expect(409);
        expect(del.body.error.code).toBe(ErrorCode.ROUND_CLOSED);
      },
    );
  });

  describe('guarded later transitions (service-level; endpoints in FEAT-005/007)', () => {
    beforeAll(async () => {
      vendor = await prisma.vendor.create({ data: { name: 'Lifecycle Vendor', phone: '+919800000001' } });
    });

    it('CLOSED_MET → ASSIGNED → DELIVERED → RATED', async () => {
      const round = await createRound('CLOSED_MET', 6);
      expect((await rounds.assign(round.id, vendor!.id, 650)).status).toBe('ASSIGNED');
      expect((await rounds.deliver(round.id)).status).toBe('DELIVERED');
      expect((await rounds.markRated(round.id)).status).toBe('RATED');
    });

    it('illegal moves → 409 INVALID_ROUND_TRANSITION and leave status unchanged', async () => {
      const expired = await createRound('CLOSED_EXPIRED');
      await expect(rounds.assign(expired.id, vendor!.id, 650)).rejects.toMatchObject({
        response: { code: ErrorCode.INVALID_ROUND_TRANSITION },
      });
      expect(await statusOf(expired.id)).toBe('CLOSED_EXPIRED');

      const open = await createRound('OPEN');
      await expect(rounds.deliver(open.id)).rejects.toMatchObject({
        response: { code: ErrorCode.INVALID_ROUND_TRANSITION },
      });

      const delivered = await createRound('DELIVERED');
      await expect(rounds.cancel(delivered.id)).rejects.toMatchObject({
        response: { code: ErrorCode.INVALID_ROUND_TRANSITION },
      });
      expect(await statusOf(delivered.id)).toBe('DELIVERED');
    });

    it('cancel is refused while any payment is collected; allowed after undo', async () => {
      const payVendor = await prisma.vendor.create({ data: { name: 'Pay Vendor', phone: '+919800000002' } });
      const round = await createRound('ASSIGNED', 3);
      try {
        await prisma.round.update({ where: { id: round.id }, data: { vendorId: payVendor.id, finalPrice: 500 } });
        const participant = await prisma.roundParticipant.create({
          data: { roundId: round.id, residentId: resident.id, units: 3, paymentCollectedAt: new Date() },
        });

        await expect(rounds.cancel(round.id)).rejects.toMatchObject({
          response: { code: ErrorCode.PAYMENTS_COLLECTED },
        });
        expect(await statusOf(round.id)).toBe('ASSIGNED');

        await rounds.setPaymentCollected(round.id, participant.id, false);
        expect((await rounds.cancel(round.id)).status).toBe('CANCELLED');
      } finally {
        await prisma.round.delete({ where: { id: round.id } });
        await prisma.vendor.delete({ where: { id: payVendor.id } });
      }
    });

    it('GET /rounds lists only OPEN rounds', async () => {
      const res = await request(app.getHttpServer())
        .get('/rounds')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const statuses = (res.body.data as Array<{ status: string }>).map((r) => r.status);
      expect(statuses.every((s) => s === 'OPEN')).toBe(true);
    });
  });
});
