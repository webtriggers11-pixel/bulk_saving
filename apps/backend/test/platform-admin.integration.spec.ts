import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * FEAT-036 (ADR-0046): a platform admin belongs to no society. Signs in at the admin door,
 * uses /admin/*, gets 403 NO_SOCIETY from society-only endpoints, `/me` answers with
 * `society: null`. `POST /admin/admins` creates one; a society-less admin can't be demoted.
 * The DB itself refuses a society-less RESIDENT and a second society-less row per phone.
 */
describe('Platform admin, no society (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let channel: CapturingChannel;
  let society: Society;
  let platform: Resident;
  let platformToken: string;
  const created: string[] = [];

  beforeAll(async () => {
    channel = new CapturingChannel();
    app = await createTestApp(channel);
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    society = await prisma.society.create({ data: { name: `Platform ${randomInviteCode()}`, city: 'Pune', inviteCode: randomInviteCode() } });
    platform = await prisma.resident.create({
      data: { societyId: null, phone: randomPhone(), name: 'Platform', role: 'SUPER_ADMIN', verifiedAt: new Date() },
    });
    created.push(platform.id);
    platformToken = (await auth.issueTokens(platform)).accessToken;
  });

  afterAll(async () => {
    await prisma.resident.deleteMany({ where: { id: { in: created } } });
    await prisma.society.deleteMany({ where: { id: society.id } });
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (path: string) => server().get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: Record<string, unknown> = {}) => server().post(path).set('Authorization', `Bearer ${token}`).send(body),
    put: (path: string, body: Record<string, unknown> = {}) => server().put(path).set('Authorization', `Bearer ${token}`).send(body),
    patch: (path: string, body: Record<string, unknown>) => server().patch(path).set('Authorization', `Bearer ${token}`).send(body),
    delete: (path: string) => server().delete(path).set('Authorization', `Bearer ${token}`),
  });

  async function waitForSend(from: number, phone: string): Promise<string> {
    for (let i = 0; i < 200; i += 1) {
      const mine = channel.otps.slice(from).filter((sent) => sent.phone === phone);
      if (mine.length > 0) return mine[mine.length - 1].code;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`no OTP dispatched to ${phone} within 2s`);
  }

  it('signs in at the admin door with no society; /me says society: null; refresh keeps it null (AC2, AC3)', async () => {
    const before = channel.otps.length;
    await server().post('/auth/admin/otp/request').send({ phone: platform.phone }).expect(200);
    const code = await waitForSend(before, platform.phone);
    const verified = await server().post('/auth/admin/otp/verify').send({ phone: platform.phone, code }).expect(200);
    const { accessToken, refreshToken, resident } = verified.body.data;
    expect(resident).toMatchObject({ id: platform.id, role: 'SUPER_ADMIN', societyId: null });

    const me = await as(accessToken).get('/me').expect(200);
    expect(me.body.data.resident.id).toBe(platform.id);
    expect(me.body.data.society).toBeNull();

    await as(accessToken).get('/admin/overview').expect(200);
    await as(accessToken).get('/admin/residents').expect(200);

    const refreshed = await server().post('/auth/refresh').send({ refreshToken }).expect(200);
    const me2 = await as(refreshed.body.data.accessToken).get('/me').expect(200);
    expect(me2.body.data.society).toBeNull();
  });

  it('prefers the society-less admin row when the phone is also an admin inside a society (AC5)', async () => {
    const phone = randomPhone();
    const standalone = await prisma.resident.create({ data: { phone, role: 'SUPER_ADMIN', societyId: null } });
    const member = await prisma.resident.create({ data: { phone, role: 'SUPER_ADMIN', societyId: society.id } });
    created.push(standalone.id, member.id);
    const before = channel.otps.length;
    await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
    const code = await waitForSend(before, phone);
    const verified = await server().post('/auth/admin/otp/verify').send({ phone, code }).expect(200);
    expect(verified.body.data.resident).toMatchObject({ id: standalone.id, societyId: null });
  });

  it('a switched-off platform row does not hide an active admin row in a society (V2 P3-1)', async () => {
    const phone = randomPhone();
    const off = await prisma.resident.create({ data: { phone, role: 'SUPER_ADMIN', societyId: null, active: false } });
    const member = await prisma.resident.create({ data: { phone, role: 'SUPER_ADMIN', societyId: society.id } });
    created.push(off.id, member.id);
    const before = channel.otps.length;
    await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
    const code = await waitForSend(before, phone);
    const verified = await server().post('/auth/admin/otp/verify').send({ phone, code }).expect(200);
    expect(verified.body.data.resident).toMatchObject({ id: member.id, societyId: society.id });
  });

  it.each([
    ['GET', '/rounds'],
    ['GET', '/rounds/mine'],
    ['POST', '/rounds/r1/join'],
    ['PATCH', '/rounds/r1/join'],
    ['DELETE', '/rounds/r1/join'],
    ['PUT', '/rounds/r1/rating'],
    ['DELETE', '/rounds/r1/rating'],
    ['POST', '/push/subscriptions'],
    ['GET', '/catalog'],
    ['POST', '/catalog/s1/ask'],
    ['DELETE', '/catalog/s1/ask'],
    ['GET', '/residents/x'],
  ])('%s %s answers 403 NO_SOCIETY to a platform admin (AC3)', async (method, path) => {
    const client = as(platformToken);
    const res =
      method === 'GET' ? await client.get(path)
      : method === 'POST' ? await client.post(path, { units: 1 })
      : method === 'PUT' ? await client.put(path, { stars: 5 })
      : method === 'PATCH' ? await client.patch(path, { units: 2 })
      : await client.delete(path);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ErrorCode.NO_SOCIETY);
  });

  it('POST /admin/admins creates a society-less admin, refuses duplicates and residents (AC4)', async () => {
    const phone = randomPhone();
    const res = await as(platformToken).post('/admin/admins', { phone, name: '  New Admin ' }).expect(201);
    expect(res.body.data).toMatchObject({ phone, name: 'New Admin', role: 'SUPER_ADMIN', society: null, active: true });
    created.push(res.body.data.id);

    const again = await as(platformToken).post('/admin/admins', { phone }).expect(409);
    expect(again.body.error.message).toMatch(/already a platform admin/);

    const resident = await prisma.resident.create({ data: { phone: randomPhone(), role: 'RESIDENT', societyId: society.id } });
    created.push(resident.id);
    const taken = await as(platformToken).post('/admin/admins', { phone: resident.phone }).expect(409);
    expect(taken.body.error.message).toContain(society.name);

    const inSocietyAdmin = await prisma.resident.create({ data: { phone: randomPhone(), role: 'SUPER_ADMIN', societyId: society.id } });
    created.push(inSocietyAdmin.id);
    const already = await as(platformToken).post('/admin/admins', { phone: inSocietyAdmin.phone }).expect(409);
    expect(already.body.error.message).toContain(`already an admin in ${society.name}`);

    await as(platformToken).post('/admin/admins', { phone: 'abc' }).expect(400);

    // The list shows platform admins with no society.
    const list = await as(platformToken).get(`/admin/residents?q=${encodeURIComponent(phone.slice(-10))}`).expect(200);
    expect(list.body.data.items).toEqual([expect.objectContaining({ phone, society: null })]);
  });

  it('a resident token cannot create admins', async () => {
    const resident = await prisma.resident.create({ data: { phone: randomPhone(), role: 'RESIDENT', societyId: society.id } });
    created.push(resident.id);
    const token = (await auth.issueTokens(resident)).accessToken;
    await as(token).post('/admin/admins', { phone: randomPhone() }).expect(403);
  });

  it('a society-less admin cannot be demoted to resident (AC5)', async () => {
    const other = await prisma.resident.create({ data: { phone: randomPhone(), role: 'SUPER_ADMIN', societyId: null } });
    created.push(other.id);
    const res = await as(platformToken).patch(`/admin/residents/${other.id}`, { role: 'RESIDENT' }).expect(409);
    expect(res.body.error.message).toMatch(/no society/);
    // Renaming and switching off still work.
    await as(platformToken).patch(`/admin/residents/${other.id}`, { name: 'Renamed', active: false }).expect(200);
  });

  it('the database refuses a society-less RESIDENT and a second society-less row for one phone (AC1)', async () => {
    await expect(
      prisma.resident.create({ data: { phone: randomPhone(), role: 'RESIDENT', societyId: null } }),
    ).rejects.toThrow(/Resident_society_or_admin_check|check constraint/i);

    await expect(
      prisma.resident.create({ data: { phone: platform.phone, role: 'SUPER_ADMIN', societyId: null } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
