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
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * FEAT-039 (ADR-0048): cancelling needs a reason; a cancelled round can be reopened with a new
 * deadline (never-assigned only, one OPEN round per pair); pledges stay and their owners hear it
 * is open again; a later re-cancel is delivered, not swallowed by dedupe.
 */
describe('Cancel with a reason, and reopen (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let society: Society;
  let service: Service;
  let resident: Resident;
  let adminToken: string;
  let residentToken: string;
  let closing: Queue;
  let reminders: Queue;
  let rounds: RoundsService;
  let auth: AuthService;
  const suffix = randomInviteCode().toLowerCase();
  const futureIso = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();
  const http = () => request(app.getHttpServer());
  const asAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`);
  const REASON = 'The vendor cancelled for that week';

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    rounds = app.get(RoundsService);
    closing = app.get<Queue>(getQueueToken(ROUND_CLOSING_QUEUE));
    reminders = app.get<Queue>(getQueueToken(ROUND_REMINDER_QUEUE));
    society = await prisma.society.create({ data: { name: `Reopen ${suffix}`, city: 'Pune', inviteCode: randomInviteCode() } });
    service = await prisma.service.create({
      data: { name: 'Tank Cleaning', slug: `tank-reopen-${suffix}`, description: 'x', category: 'Utilities', active: true },
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

  /** A fresh OPEN round, after cancelling anything still OPEN for the pair (one OPEN per pair). */
  async function openRound(): Promise<string> {
    const open = await prisma.round.findMany({ where: { societyId: society.id, status: 'OPEN' } });
    for (const r of open) await cancel(r.id, 'Making room').expect(201);
    const res = await asAdmin(http().post('/admin/rounds')).send({
      societyId: society.id,
      serviceId: service.id,
      deadline: futureIso(5),
      tiers: [{ threshold: 1, price: 900 }, { threshold: 10, price: 700 }],
    }).expect(201);
    return res.body.data.id as string;
  }
  const cancel = (id: string, reason?: string) =>
    asAdmin(http().post(`/admin/rounds/${id}/cancel`)).send(reason === undefined ? {} : { reason });
  const join = (id: string, token = residentToken, units = 2) =>
    http().post(`/rounds/${id}/join`).set('Authorization', `Bearer ${token}`).send({ units }).expect(201);
  const reopen = (id: string, deadline = futureIso(4)) => asAdmin(http().post(`/admin/rounds/${id}/reopen`)).send({ deadline });
  /** A cancelled round with the test resident's pledge of 2. */
  async function cancelledWithPledge(): Promise<string> {
    const id = await openRound();
    await join(id);
    await cancel(id, REASON).expect(201);
    return id;
  }

  it('a cancel needs a reason; it is stored and shown to admins and residents (AC2)', async () => {
    const id = await openRound();
    await join(id);
    await cancel(id).expect(400);
    await cancel(id, '  x ').expect(400);
    await cancel(id, `  ${REASON}  `).expect(201);
    const detail = await asAdmin(http().get(`/admin/rounds/${id}`)).expect(200);
    expect(detail.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: REASON, canReopen: true });
    expect(detail.body.data.cancelledAt).toEqual(expect.any(String));
    const list = await asAdmin(http().get(`/admin/rounds?societyId=${society.id}&status=CANCELLED`)).expect(200);
    expect((list.body.data.items as Array<{ id: string; cancelReason: string | null }>).find((r) => r.id === id)?.cancelReason).toBe(REASON);
    const mine = await http().get('/rounds/mine').set('Authorization', `Bearer ${residentToken}`).expect(200);
    const view = (mine.body.data.items as Array<{ id: string; cancelReason: string | null }>).find((r) => r.id === id);
    expect(view?.cancelReason).toBe(REASON);
  });

  it('reopens with a new deadline: OPEN, reason cleared, jobs scheduled, pledge kept, owner told once (AC3)', async () => {
    const id = await cancelledWithPledge();
    const deadline = futureIso(4);
    const res = await reopen(id, deadline).expect(201);
    expect(res.body.data).toMatchObject({ status: 'OPEN', cancelReason: null, canReopen: false, unitsCount: 2 });
    expect(res.body.data.deadline).toBe(deadline);
    expect(await closing.getJob(id)).toBeTruthy();
    expect(await reminders.getJob(reminderJobId(id))).toBeTruthy();
    const told = await prisma.notification.findMany({ where: { roundId: id, residentId: resident.id, type: 'ROUND_REOPENED' } });
    expect(told).toHaveLength(1);
    expect(told[0].body).toContain('still stands');
    expect(told[0].dedupeKey).toMatch(/:c1$/);
  });

  it('a pledger who also asked hears "open again" only; another asker hears "you asked" with a cycle key (V2 r3 P3-2)', async () => {
    const id = await cancelledWithPledge();
    const other = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'RESIDENT' } });
    const otherToken = (await auth.issueTokens(other)).accessToken;
    await http().post(`/catalog/${service.id}/ask`).set('Authorization', `Bearer ${residentToken}`).expect(200);
    await http().post(`/catalog/${service.id}/ask`).set('Authorization', `Bearer ${otherToken}`).expect(200);
    await reopen(id).expect(201);
    const mine = await prisma.notification.findMany({ where: { roundId: id, residentId: resident.id } });
    expect(mine.filter((n) => n.type === 'SERVICE_ASK_OPENED')).toHaveLength(0);
    const theirs = await prisma.notification.findMany({ where: { roundId: id, residentId: other.id, type: 'SERVICE_ASK_OPENED' } });
    expect(theirs).toHaveLength(1);
    expect(theirs[0].dedupeKey).toMatch(/:c1$/);
    expect(await prisma.serviceAsk.count({ where: { serviceId: service.id, societyId: society.id } })).toBe(0);
  });

  it('a re-cancel after a reopen is delivered again, not swallowed by dedupe (AC4)', async () => {
    const id = await cancelledWithPledge();
    await reopen(id).expect(201);
    await cancel(id, 'Second time: rain').expect(201);
    const cancels = await prisma.notification.findMany({ where: { roundId: id, residentId: resident.id, type: 'ROUND_CANCELLED' } });
    expect(cancels).toHaveLength(2);
    expect(new Set(cancels.map((n) => n.dedupeKey)).size).toBe(2);
  });

  it('CLOSED_MET → CANCELLED → OPEN → closed again: the second close is delivered (AC4)', async () => {
    const id = await openRound();
    await join(id);
    expect((await rounds.closeRound(id))?.status).toBe('CLOSED_MET');
    await cancel(id, 'Vendor fell through').expect(201);
    await reopen(id).expect(201);
    expect((await rounds.closeRound(id))?.status).toBe('CLOSED_MET');
    const met = await prisma.notification.findMany({ where: { roundId: id, residentId: resident.id, type: 'ROUND_CLOSED_MET' } });
    expect(met.map((n) => n.dedupeKey).sort()).toEqual([`ROUND_CLOSED_MET:${id}:${resident.id}`, `ROUND_CLOSED_MET:${id}:${resident.id}:c1`].sort());
  });

  it('refuses a past deadline, a round that is not cancelled, and a second open round for the pair (AC3)', async () => {
    const id = await cancelledWithPledge();
    await reopen(id, new Date(Date.now() - 60_000).toISOString()).expect(400);
    const other = await openRound();
    const clash = await reopen(id).expect(409);
    expect(clash.body.error.code).toBe(ErrorCode.ROUND_ALREADY_OPEN);
    const notCancelled = await reopen(other).expect(409);
    expect(notCancelled.body.error.code).toBe(ErrorCode.INVALID_ROUND_TRANSITION);
    await cancel(other, 'Clean up').expect(201);
  });

  it('refuses when the service is no longer offered or the society is switched off (V2 r3 P2-1)', async () => {
    const id = await cancelledWithPledge();
    await prisma.serviceOffering.update({ where: { societyId_serviceId: { societyId: society.id, serviceId: service.id } }, data: { enabled: false } });
    try {
      expect((await reopen(id).expect(400)).body.error.message).toMatch(/not offered/);
    } finally {
      await prisma.serviceOffering.update({ where: { societyId_serviceId: { societyId: society.id, serviceId: service.id } }, data: { enabled: true } });
    }
    await prisma.society.update({ where: { id: society.id }, data: { active: false } });
    try {
      expect((await reopen(id).expect(400)).body.error.message).toMatch(/switched off/);
    } finally {
      await prisma.society.update({ where: { id: society.id }, data: { active: true } });
    }
  });

  it('a round that had a vendor cannot be reopened (AC3)', async () => {
    const id = await cancelledWithPledge();
    const vendor = await prisma.vendor.create({ data: { name: `V ${suffix}`, phone: randomPhone(), category: 'Utilities' } });
    try {
      await prisma.round.update({ where: { id }, data: { vendorId: vendor.id } });
      const detail = await asAdmin(http().get(`/admin/rounds/${id}`)).expect(200);
      expect(detail.body.data.canReopen).toBe(false);
      const res = await reopen(id).expect(409);
      expect(res.body.error.message).toMatch(/cannot be reopened/);
    } finally {
      await prisma.round.update({ where: { id }, data: { vendorId: null } });
      await prisma.vendor.delete({ where: { id: vendor.id } });
    }
  });

  it('residents cannot cancel or reopen', async () => {
    const id = await openRound();
    await http().post(`/admin/rounds/${id}/cancel`).set('Authorization', `Bearer ${residentToken}`).send({ reason: 'Nope nope' }).expect(403);
    await cancel(id, 'Clean up').expect(201);
    await http().post(`/admin/rounds/${id}/reopen`).set('Authorization', `Bearer ${residentToken}`).send({ deadline: futureIso(3) }).expect(403);
  });
});
