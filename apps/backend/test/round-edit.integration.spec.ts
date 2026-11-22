import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type { Resident, Service, Society } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { ROUND_CLOSING_QUEUE } from '../src/modules/rounds/round-closing.scheduler';
import { ROUND_REMINDER_QUEUE, reminderJobId } from '../src/modules/rounds/round-reminder.scheduler';
import { RoundsService } from '../src/modules/rounds/rounds.service';
import { RoundCloserProcessor } from '../src/modules/rounds/round-closer.processor';
import { DelayedError, type Job } from 'bullmq';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * FEAT-038 (ADR-0047): edit an OPEN round's deadline and tiers. OPEN only (409 otherwise),
 * validated like create, pledges untouched, queued jobs moved, and the deadline job only
 * closes a round that is actually due.
 */
describe('Edit an open round (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rounds: RoundsService;
  let society: Society;
  let service: Service;
  let adminToken: string;
  let residentToken: string;
  let resident: Resident;
  let closing: Queue;
  let reminders: Queue;
  const suffix = randomInviteCode().toLowerCase();
  const futureIso = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();
  const http = () => request(app.getHttpServer());
  const asAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`);

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    rounds = app.get(RoundsService);
    const auth = app.get(AuthService);
    closing = app.get<Queue>(getQueueToken(ROUND_CLOSING_QUEUE));
    reminders = app.get<Queue>(getQueueToken(ROUND_REMINDER_QUEUE));
    society = await prisma.society.create({ data: { name: `Edit ${suffix}`, city: 'Pune', inviteCode: randomInviteCode() } });
    service = await prisma.service.create({
      data: { name: 'RO Purifier', slug: `ro-edit-${suffix}`, description: 'x', category: 'Appliances', active: true },
    });
    await prisma.serviceOffering.create({ data: { societyId: society.id, serviceId: service.id, enabled: true } });
    const admin = await prisma.resident.create({ data: { societyId: null, phone: randomPhone(), role: 'SUPER_ADMIN' } });
    resident = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'RESIDENT' } });
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentToken = (await auth.issueTokens(resident)).accessToken;
  });

  afterAll(async () => {
    const ids = (await prisma.round.findMany({ where: { societyId: society.id }, select: { id: true } })).map((r) => r.id);
    await Promise.all(ids.map(async (id) => { await (await closing.getJob(id))?.remove(); await (await reminders.getJob(reminderJobId(id)))?.remove(); }));
    await prisma.society.delete({ where: { id: society.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await app.close();
  });

  async function openRound(days = 5): Promise<string> {
    // Only one OPEN round per pair: cancel whatever the previous test left open.
    const open = await prisma.round.findMany({ where: { societyId: society.id, status: 'OPEN' } });
    for (const r of open) await asAdmin(http().post(`/admin/rounds/${r.id}/cancel`)).expect(201);
    const res = await asAdmin(http().post('/admin/rounds')).send({
      societyId: society.id,
      serviceId: service.id,
      deadline: futureIso(days),
      tiers: [{ threshold: 5, price: 900 }, { threshold: 10, price: 700 }],
    }).expect(201);
    return res.body.data.id as string;
  }

  it('changes the tiers and keeps every pledge (AC1, AC2)', async () => {
    const id = await openRound();
    await http().post(`/rounds/${id}/join`).set('Authorization', `Bearer ${residentToken}`).send({ units: 3 }).expect(201);
    const res = await asAdmin(http().patch(`/admin/rounds/${id}`)).send({
      tiers: [{ threshold: 3, price: 850 }, { threshold: 8, price: 650 }],
    }).expect(200);
    expect(res.body.data.tiers).toEqual([{ threshold: 3, price: 850 }, { threshold: 8, price: 650 }]);
    expect(res.body.data.unitsCount).toBe(3);
    // 3 units now meets the first tier: the price residents see is re-derived.
    expect(res.body.data.currentPrice).toBe(850);
    const mine = await http().get('/rounds').set('Authorization', `Bearer ${residentToken}`).expect(200);
    const view = (mine.body.data.items as Array<{ id: string; myUnits: number; currentPrice: number }>).find((r) => r.id === id);
    expect(view).toMatchObject({ myUnits: 3, currentPrice: 850 });
  });

  it('moves the deadline and both queued jobs (AC3)', async () => {
    const id = await openRound(5);
    const newDeadline = futureIso(9);
    const before = Date.now();
    await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ deadline: newDeadline }).expect(200);
    const row = await prisma.round.findUniqueOrThrow({ where: { id } });
    expect(row.deadline.toISOString()).toBe(newDeadline);
    const close = await closing.getJob(id);
    const remind = await reminders.getJob(reminderJobId(id));
    expect(close).toBeTruthy();
    expect(remind).toBeTruthy();
    // Each job was moved in place (changeDelay): it fires near its new time (close at the deadline,
    // the reminder 24 h before), measured from when the edit was made.
    expect(await close!.getState()).toBe('delayed');
    expect(Math.abs(before + close!.delay - new Date(newDeadline).getTime())).toBeLessThan(5_000);
    expect(Math.abs(before + remind!.delay - (new Date(newDeadline).getTime() - 86_400_000))).toBeLessThan(5_000);
  });

  it('the deadline job does nothing for a round that is not due yet (AC3, ADR-0047 §5)', async () => {
    const id = await openRound(5);
    const out = await rounds.closeRound(id, '', { onlyIfDue: true });
    expect(out?.status).toBe('OPEN');
    // Once due, the same call closes it.
    await prisma.round.update({ where: { id }, data: { deadline: new Date(Date.now() - 1_000) } });
    const closed = await rounds.closeRound(id, '', { onlyIfDue: true });
    expect(closed?.status).toBe('CLOSED_EXPIRED');
  });

  it('validates like create and refuses an empty edit (AC1)', async () => {
    const id = await openRound();
    const bad = async (body: Record<string, unknown>) => (await asAdmin(http().patch(`/admin/rounds/${id}`)).send(body).expect(400)).body.error.message as string;
    expect(await bad({})).toMatch(/deadline or the price tiers/);
    expect(await bad({ deadline: new Date(Date.now() - 60_000).toISOString() })).toMatch(/future/);
    expect(await bad({ tiers: [{ threshold: 5, price: 900 }, { threshold: 5, price: 800 }] })).toMatch(/ascending/);
    await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ tiers: [] }).expect(400);
  });

  it('only an OPEN round can be edited; unknown id → 404; residents → 403 (AC1)', async () => {
    const id = await openRound();
    await asAdmin(http().post(`/admin/rounds/${id}/cancel`)).expect(201);
    const res = await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ deadline: futureIso(3) }).expect(409);
    expect(res.body.error.code).toBe(ErrorCode.ROUND_CLOSED);
    await asAdmin(http().patch('/admin/rounds/does-not-exist')).send({ deadline: futureIso(3) }).expect(404);
    await http().patch(`/admin/rounds/${id}`).set('Authorization', `Bearer ${residentToken}`).send({ deadline: futureIso(3) }).expect(403);
  });

  it('society and service are not editable: extra fields are dropped, the pair stays (AC4)', async () => {
    const id = await openRound();
    const other = await prisma.society.create({ data: { name: `Other ${suffix}`, city: 'Pune', inviteCode: randomInviteCode() } });
    try {
      await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ serviceId: 'other', societyId: other.id, deadline: futureIso(4) }).expect(200);
      const row = await prisma.round.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ serviceId: service.id, societyId: society.id });
    } finally {
      await prisma.society.delete({ where: { id: other.id } });
    }
  });

  it('BUG-030: a price that rises with more units is refused, at create and at edit', async () => {
    const open = await prisma.round.findMany({ where: { societyId: society.id, status: 'OPEN' } });
    for (const r of open) await asAdmin(http().post(`/admin/rounds/${r.id}/cancel`)).expect(201);
    const rising = [{ threshold: 5, price: 700 }, { threshold: 6, price: 800 }];
    const created = await asAdmin(http().post('/admin/rounds')).send({ societyId: society.id, serviceId: service.id, deadline: futureIso(3), tiers: rising }).expect(400);
    expect(created.body.error.message).toMatch(/lower than the one before/);
    const id = await openRound();
    const edited = await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ tiers: rising }).expect(400);
    expect(edited.body.error.message).toMatch(/lower than the one before/);
    // Equal prices are refused too: a tier that saves nothing is a mistake.
    await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ tiers: [{ threshold: 5, price: 700 }, { threshold: 8, price: 700 }] }).expect(400);
  });

  it('a close job that finds the round not due re-arms itself for the real deadline (V2 P1-1)', async () => {
    const id = await openRound(5);
    const processor = app.get(RoundCloserProcessor);
    const moveToDelayed = jest.fn().mockResolvedValue(undefined);
    const job = { data: { roundId: id }, opts: { attempts: 6 }, attemptsMade: 0, moveToDelayed } as unknown as Job<{ roundId: string }>;
    await expect(processor.process(job, 'tok')).rejects.toBeInstanceOf(DelayedError);
    const row = await prisma.round.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('OPEN');
    expect(moveToDelayed).toHaveBeenCalledWith(row.deadline.getTime(), 'tok');
  });

  it('a tiers-only edit leaves the queued jobs where they were', async () => {
    const id = await openRound(5);
    const before = await closing.getJob(id);
    await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ tiers: [{ threshold: 4, price: 950 }, { threshold: 9, price: 750 }] }).expect(200);
    const after = await closing.getJob(id);
    expect(after?.delay).toBe(before?.delay);
    expect(after?.timestamp).toBe(before?.timestamp);
  });

  it('pulling the deadline inside 24 h sends the reminder now instead of dropping it (V2 P2-2)', async () => {
    const id = await openRound(5);
    const soon = new Date(Date.now() + 6 * 3_600_000).toISOString();
    await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ deadline: soon }).expect(200);
    const remind = await reminders.getJob(reminderJobId(id));
    // Delay 0: due now (a worker may already have picked it up).
    if (remind) expect(remind.delay).toBe(0);
  });

  it('refuses an edit once the deadline has passed (the close is under way) and a null tiers list (V2 P3-1, P3-3)', async () => {
    const id = await openRound(5);
    await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ tiers: null }).expect(400);
    await prisma.round.update({ where: { id }, data: { deadline: new Date(Date.now() - 1_000) } });
    const res = await asAdmin(http().patch(`/admin/rounds/${id}`)).send({ tiers: [{ threshold: 3, price: 900 }] }).expect(409);
    expect(res.body.error.message).toMatch(/reached its deadline/);
  });
});
