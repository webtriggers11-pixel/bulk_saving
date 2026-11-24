import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import type { AdminResidentDetailDto, AdminResidentDto, AdminSocietyDetailDto, AdminResidentPledgeDto, Page } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { RedisService } from '../src/redis/redis.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Active/inactive (FEAT-035, ADR-0045): a switched-off resident cannot sign in or refresh and
 * loses every session; an inactive society's code admits nobody; the user detail page lists
 * every pledge; guards against switching yourself off.
 */
describe('Active flags (integration, needs DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  const channel = new CapturingChannel();
  let society: Society;
  let admin: Resident;
  let neha: Resident;
  let adminToken: string;
  const tag = randomInviteCode();
  const serviceIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp(channel);
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    society = await prisma.society.create({ data: { name: `Active ${tag}`, city: 'Pune', inviteCode: randomInviteCode() } });
    admin = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() } });
    neha = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), name: `Neha ${tag}`, role: 'RESIDENT', verifiedAt: new Date() } });
    adminToken = (await auth.issueTokens(admin)).accessToken;
  });

  afterAll(async () => {
    await prisma.society.delete({ where: { id: society.id } });
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = {
    get: (path: string) => api().get(path).set('Authorization', `Bearer ${adminToken}`),
    patch: (path: string, body: Record<string, unknown>) => api().patch(path).set('Authorization', `Bearer ${adminToken}`).send(body),
  };

  async function signInAttempt(phone: string, inviteCode = society.inviteCode): Promise<request.Response> {
    const req = await api().post('/auth/otp/request').send({ inviteCode, phone });
    if (req.status !== 200) return req;
    const code = [...channel.otps].reverse().find((o) => o.phone === phone)?.code;
    return api().post('/auth/otp/verify').send({ inviteCode, phone, code });
  }

  it('switching a resident off: their refresh dies, sign-in says ACCOUNT_DISABLED; switching back on restores sign-in', async () => {
    const tokens = await auth.issueTokens(neha);
    const off = (await asAdmin.patch(`/admin/residents/${neha.id}`, { active: false }).expect(200)).body.data as AdminResidentDto;
    expect(off.active).toBe(false);
    await api().post('/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);

    const refused = await signInAttempt(neha.phone);
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe(ErrorCode.ACCOUNT_DISABLED);

    // Back on: tokens issue and refresh again. (A second SMS for the same phone would hit the
    // resend interval, so the switch-on is proven through the token service the doors call.)
    await asAdmin.patch(`/admin/residents/${neha.id}`, { active: true }).expect(200);
    const fresh = await auth.issueTokens(await prisma.resident.findUniqueOrThrow({ where: { id: neha.id } }));
    await api().post('/auth/refresh').send({ refreshToken: fresh.refreshToken }).expect(200);
  });

  it('an admin cannot switch themselves off', async () => {
    const res = await asAdmin.patch(`/admin/residents/${admin.id}`, { active: false }).expect(409);
    expect(res.body.error.code).toBe(ErrorCode.CONFLICT);
  });

  it('filters users by status', async () => {
    await asAdmin.patch(`/admin/residents/${neha.id}`, { active: false }).expect(200);
    const inactive = (await asAdmin.get(`/admin/residents?societyId=${society.id}&status=inactive`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(inactive.items.map((r) => r.id)).toEqual([neha.id]);
    const active = (await asAdmin.get(`/admin/residents?societyId=${society.id}&status=active`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(active.items.map((r) => r.id)).toEqual([admin.id]);
    await asAdmin.get('/admin/residents?status=asleep').expect(400);
    await asAdmin.patch(`/admin/residents/${neha.id}`, { active: true }).expect(200);
  });

  it('the user detail lists every pledge with service, status, units and payment', async () => {
    const service = await prisma.service.create({
      data: { name: `Detail svc ${tag}`, slug: `detail-${tag.toLowerCase()}`, description: 'x', category: 'Home Care', active: true },
    });
    serviceIds.push(service.id);
    await prisma.round.create({
      data: {
        societyId: society.id,
        serviceId: service.id,
        status: 'OPEN',
        unitsCount: 2,
        deadline: new Date(Date.now() + 86_400_000),
        tiers: { create: [{ threshold: 2, price: 900 }] },
        participants: { create: [{ residentId: neha.id, units: 2 }] },
      },
    });
    const detail = (await asAdmin.get(`/admin/residents/${neha.id}`).expect(200)).body.data as AdminResidentDetailDto;
    expect(detail).toMatchObject({ id: neha.id, active: true, society: { id: society.id } });
    expect(detail).toMatchObject({ pledgeCount: 1 });
    // FEAT-044: the pledges are paged.
    const pledges = (await asAdmin.get(`/admin/residents/${neha.id}/pledges`).expect(200)).body.data as Page<AdminResidentPledgeDto>;
    expect(pledges).toMatchObject({ total: 1, nextCursor: null });
    expect(pledges.items).toEqual([
      expect.objectContaining({ serviceName: `Detail svc ${tag}`, status: 'OPEN', units: 2, paid: false }),
    ]);
    await asAdmin.get('/admin/residents/nope/pledges').expect(404);
    await asAdmin.get('/admin/residents/nope').expect(404);
  });

  it("an inactive society's code admits nobody (same answer as an unknown code); back on, it works", async () => {
    const off = (await asAdmin.patch(`/admin/societies/${society.id}`, { active: false }).expect(200)).body.data as AdminSocietyDetailDto;
    expect(off.active).toBe(false);
    const res = await api().post('/auth/otp/request').send({ inviteCode: society.inviteCode, phone: randomPhone() });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_INVITE_CODE);
    await asAdmin.patch(`/admin/societies/${society.id}`, { active: true }).expect(200);
    await api().post('/auth/otp/request').send({ inviteCode: society.inviteCode, phone: randomPhone() }).expect(200);
  });

  async function waitForSend(from: number, phone: string): Promise<string> {
    for (let i = 0; i < 200; i += 1) {
      const mine = channel.otps.slice(from).filter((sent) => sent.phone === phone);
      if (mine.length > 0) return mine[mine.length - 1].code;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`no OTP dispatched to ${phone} within 2s`);
  }

  it('V2 P1: a switched-off admin\'s still-valid token cannot switch itself back on, or do anything admin', async () => {
    const other = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() } });
    const otherToken = (await auth.issueTokens(other)).accessToken;
    await asAdmin.patch(`/admin/residents/${other.id}`, { active: false }).expect(200);
    // The JWT is still unexpired, but every admin route re-reads the row.
    const back = await api().patch(`/admin/residents/${other.id}`).set('Authorization', `Bearer ${otherToken}`).send({ active: true });
    expect(back.status).toBe(403);
    expect(back.body.error.code).toBe(ErrorCode.ACCOUNT_DISABLED);
    await api().patch(`/admin/residents/${admin.id}`).set('Authorization', `Bearer ${otherToken}`).send({ active: false }).expect(403);
    await api().get('/admin/overview').set('Authorization', `Bearer ${otherToken}`).expect(403);
    expect((await prisma.resident.findUniqueOrThrow({ where: { id: other.id } })).active).toBe(false);
  });

  it('a demoted admin\'s old token is refused on admin routes at once', async () => {
    const other = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() } });
    const otherToken = (await auth.issueTokens(other)).accessToken;
    await asAdmin.patch(`/admin/residents/${other.id}`, { role: 'RESIDENT' }).expect(200);
    const res = await api().get('/admin/residents').set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('switching off ends every stored session (revokeAllSessions ran)', async () => {
    const r = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() } });
    await auth.issueTokens(r);
    await auth.issueTokens(r);
    const redis = app.get(RedisService);
    expect(await redis.smembers(`sessions:${r.id}`)).toHaveLength(2);
    await asAdmin.patch(`/admin/residents/${r.id}`, { active: false }).expect(200);
    expect(await redis.smembers(`sessions:${r.id}`)).toHaveLength(0);
  });

  it('the admin OTP door refuses a switched-off admin (ACCOUNT_DISABLED) after the right code', async () => {
    const other = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', active: false, verifiedAt: new Date() } });
    const from = channel.otps.length;
    await api().post('/auth/admin/otp/request').send({ phone: other.phone }).expect(200);
    const code = await waitForSend(from, other.phone);
    const res = await api().post('/auth/admin/otp/verify').send({ phone: other.phone, code });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.ACCOUNT_DISABLED);
  });

  it('a switched-off resident at the society door is refused before any profile write', async () => {
    const r = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), name: 'Before', role: 'RESIDENT', active: false, verifiedAt: null } });
    const res = await api().post('/auth/otp/request').send({ inviteCode: society.inviteCode, phone: r.phone }).expect(200);
    expect(res.body.data.requested).toBe(true);
    const code = [...channel.otps].reverse().find((o) => o.phone === r.phone)?.code;
    const verify = await api().post('/auth/otp/verify').send({ inviteCode: society.inviteCode, phone: r.phone, code, name: 'Renamed' });
    expect(verify.status).toBe(403);
    expect(verify.body.error.code).toBe(ErrorCode.ACCOUNT_DISABLED);
    const after = await prisma.resident.findUniqueOrThrow({ where: { id: r.id } });
    expect(after).toMatchObject({ name: 'Before', verifiedAt: null });
  });

  it("an inactive society's code also fails at verify (a code requested before the switch-off is useless)", async () => {
    const phone = randomPhone();
    await api().post('/auth/otp/request').send({ inviteCode: society.inviteCode, phone }).expect(200);
    const code = [...channel.otps].reverse().find((o) => o.phone === phone)?.code;
    await asAdmin.patch(`/admin/societies/${society.id}`, { active: false }).expect(200);
    const res = await api().post('/auth/otp/verify').send({ inviteCode: society.inviteCode, phone, code });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_INVITE_CODE);
    await asAdmin.patch(`/admin/societies/${society.id}`, { active: true }).expect(200);
  });
});
