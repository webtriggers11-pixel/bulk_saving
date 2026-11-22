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
  const suffix = randomInviteCode().toLowerCase();
  const futureIso = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString();
  const http = () => request(app.getHttpServer());
  const asAdmin = (r: request.Test) => r.set('Authorization', `Bearer ${adminToken}`);
  const REASON = 'The vendor cancelled for that week';

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
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

  async function openRound(): Promise<string> {
    const res = await asAdmin(http().post('/admin/rounds')).send({
      societyId: society.id,
      serviceId: service.id,
      deadline: futureIso(5),
      tiers: [{ threshold: 5, price: 900 }, { threshold: 10, price: 700 }],
    }).expect(201);
    return res.body.data.id as string;
  }
  const cancel = (id: string, reason?: string) =>
    asAdmin(http().post(`/admin/rounds/${id}/cancel`)).send(reason === undefined ? {} : { reason });

  it('a cancel needs a reason; it is stored and shown to admins and residents (AC2)', async () => {
    const id = await openRound();
    await http().post(`/rounds/${id}/join`).set('Authorization', `Bearer ${residentToken}`).send({ units: 2 }).expect(201);
    await cancel(id).expect(400);
    await cancel(id, '  x ').expect(400);
    await cancel(id, `  ${REASON}  `).expect(201);
    const detail = await asAdmin(http().get(`/admin/rounds/${id}`)).expect(200);
    expect(detail.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: REASON, canReopen: true });
    expect(detail.body.data.cancelledAt).toEqual(expect.any(String));
    const mine = await http().get('/rounds/mine').set('Authorization', `Bearer ${residentToken}`).expect(200);
    const view = (mine.body.data.items as Array<{ id: string; cancelReason: string | null }>).find((r) => r.id === id);
    expect(view?.cancelReason).toBe(REASON);
  });

  it('reopens with a new deadline: OPEN, reason cleared, jobs scheduled, pledge kept, owner told (AC3)', async () => {
    const cancelled = await prisma.round.findFirstOrThrow({ where: { societyId: society.id, status: 'CANCELLED' } });
    const deadline = futureIso(4);
    const res = await asAdmin(http().post(`/admin/rounds/${cancelled.id}/reopen`)).send({ deadline }).expect(201);
    expect(res.body.data).toMatchObject({ status: 'OPEN', cancelReason: null, canReopen: false, unitsCount: 2 });
    expect(res.body.data.deadline).toBe(deadline);
    expect(await closing.getJob(cancelled.id)).toBeTruthy();
    expect(await reminders.getJob(reminderJobId(cancelled.id))).toBeTruthy();
    const told = await prisma.notification.findMany({ where: { roundId: cancelled.id, residentId: resident.id, type: 'ROUND_REOPENED' } });
    expect(told).toHaveLength(1);
    expect(told[0].body).toContain('still stands');
  });

  it('a re-cancel after a reopen is delivered again, not swallowed by dedupe (AC4)', async () => {
    const round = await prisma.round.findFirstOrThrow({ where: { societyId: society.id, status: 'OPEN' } });
    await cancel(round.id, 'Second time: rain').expect(201);
    const cancels = await prisma.notification.findMany({ where: { roundId: round.id, residentId: resident.id, type: 'ROUND_CANCELLED' } });
    expect(cancels).toHaveLength(2);
    expect(new Set(cancels.map((n) => n.dedupeKey)).size).toBe(2);
  });

  it('refuses a past deadline, a round that is not cancelled, and a second open round for the pair (AC3)', async () => {
    const cancelled = await prisma.round.findFirstOrThrow({ where: { societyId: society.id, status: 'CANCELLED' } });
    await asAdmin(http().post(`/admin/rounds/${cancelled.id}/reopen`)).send({ deadline: new Date(Date.now() - 60_000).toISOString() }).expect(400);
    const other = await openRound();
    const clash = await asAdmin(http().post(`/admin/rounds/${cancelled.id}/reopen`)).send({ deadline: futureIso(3) }).expect(409);
    expect(clash.body.error.code).toBe(ErrorCode.ROUND_ALREADY_OPEN);
    const notCancelled = await asAdmin(http().post(`/admin/rounds/${other}/reopen`)).send({ deadline: futureIso(3) }).expect(409);
    expect(notCancelled.body.error.code).toBe(ErrorCode.INVALID_ROUND_TRANSITION);
    await cancel(other, 'Clean up').expect(201);
  });

  it('a round that had a vendor cannot be reopened (AC3)', async () => {
    const cancelled = await prisma.round.findFirstOrThrow({ where: { societyId: society.id, status: 'CANCELLED' } });
    const vendor = await prisma.vendor.create({ data: { name: `V ${suffix}`, phone: randomPhone(), category: 'Utilities' } });
    try {
      await prisma.round.update({ where: { id: cancelled.id }, data: { vendorId: vendor.id } });
      const detail = await asAdmin(http().get(`/admin/rounds/${cancelled.id}`)).expect(200);
      expect(detail.body.data.canReopen).toBe(false);
      const res = await asAdmin(http().post(`/admin/rounds/${cancelled.id}/reopen`)).send({ deadline: futureIso(3) }).expect(409);
      expect(res.body.error.message).toMatch(/cannot be reopened/);
    } finally {
      await prisma.round.update({ where: { id: cancelled.id }, data: { vendorId: null } });
      await prisma.vendor.delete({ where: { id: vendor.id } });
    }
  });

  it('residents cannot cancel or reopen', async () => {
    const cancelled = await prisma.round.findFirstOrThrow({ where: { societyId: society.id, status: 'CANCELLED' } });
    await http().post(`/admin/rounds/${cancelled.id}/reopen`).set('Authorization', `Bearer ${residentToken}`).send({ deadline: futureIso(3) }).expect(403);
  });
});
