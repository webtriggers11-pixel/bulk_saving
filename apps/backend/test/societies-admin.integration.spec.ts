import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import type { AdminSocietyDetailDto } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Societies admin API (FEAT-032, ADR-0043): list with counts, detail, create with a
 * server-generated code, rename, rotate the code (the old one stops working at the resident
 * door), and delete only while empty. SUPER_ADMIN only. The society table is shared with
 * parallel suites, so assertions only look at this suite's rows.
 */
describe('Societies admin API (integration, needs DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let home: Society;
  let admin: Resident;
  let adminToken: string;
  let residentToken: string;
  const created: string[] = [];
  const tag = randomInviteCode();

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
    home = await prisma.society.create({ data: { name: `Societies Admin ${tag}`, city: 'Pune', inviteCode: randomInviteCode() } });
    admin = await prisma.resident.create({ data: { societyId: home.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() } });
    const resident = await prisma.resident.create({ data: { societyId: home.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() } });
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentToken = (await auth.issueTokens(resident)).accessToken;
  });

  afterAll(async () => {
    await prisma.society.deleteMany({ where: { id: { in: [...created, home.id] } } });
    await app.close();
  });

  const as = (token: string) => ({
    get: (path: string) => request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: Record<string, unknown> = {}) => request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`).send(body),
    patch: (path: string, body: Record<string, unknown>) => request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${token}`).send(body),
    delete: (path: string) => request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${token}`),
  });

  async function createSociety(name: string): Promise<AdminSocietyDetailDto> {
    const res = await as(adminToken).post('/admin/societies', { name, city: '  Mumbai ' }).expect(201);
    const society = res.body.data as AdminSocietyDetailDto;
    created.push(society.id);
    return society;
  }

  it('a resident gets 403 on every society route', async () => {
    const r = as(residentToken);
    await r.get('/admin/societies').expect(403);
    await r.get(`/admin/societies/${home.id}`).expect(403);
    await r.post('/admin/societies', { name: 'Nope', city: 'Pune' }).expect(403);
    await r.patch(`/admin/societies/${home.id}`, { name: 'Nope' }).expect(403);
    await r.post(`/admin/societies/${home.id}/invite-code`).expect(403);
    await r.delete(`/admin/societies/${home.id}`).expect(403);
  });

  it('creates a society with a generated, look-alike-free code; trims the fields; counts start at 0', async () => {
    const society = await createSociety(`  Lakeview ${tag} `);
    expect(society).toMatchObject({ name: `Lakeview ${tag}`, city: 'Mumbai', residentCount: 0, roundCount: 0 });
    expect(society.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(typeof society.createdAt).toBe('string');
  });

  it('ignores a client-chosen invite code (the server always generates it)', async () => {
    // The global ValidationPipe (whitelist) strips the unknown property.
    const res = await as(adminToken).post('/admin/societies', { name: `Chosen ${tag}`, city: 'Pune', inviteCode: 'AAAAAAAA' }).expect(201);
    created.push(res.body.data.id);
    expect(res.body.data.inviteCode).not.toBe('AAAAAAAA');
  });

  it('validates name and city', async () => {
    await as(adminToken).post('/admin/societies', { name: ' ', city: 'Pune' }).expect(400);
    await as(adminToken).post('/admin/societies', { name: 'Okay name', city: '' }).expect(400);
    await as(adminToken).post('/admin/societies', { name: 'x'.repeat(81), city: 'Pune' }).expect(400);
  });

  it('lists every society with resident and round counts', async () => {
    const res = await as(adminToken).get('/admin/societies').expect(200);
    const mine = (res.body.data as AdminSocietyDetailDto[]).find((s) => s.id === home.id);
    expect(mine).toMatchObject({ id: home.id, inviteCode: home.inviteCode, residentCount: 2, roundCount: 0 });
  });

  it('detail: 200 for a real society, 404 for an unknown id', async () => {
    const res = await as(adminToken).get(`/admin/societies/${home.id}`).expect(200);
    expect(res.body.data).toMatchObject({ id: home.id, residentCount: 2 });
    const missing = await as(adminToken).get('/admin/societies/does-not-exist').expect(404);
    expect(missing.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('renames a society without touching its code', async () => {
    const society = await createSociety(`Rename ${tag}`);
    const res = await as(adminToken).patch(`/admin/societies/${society.id}`, { name: `Renamed ${tag}` }).expect(200);
    expect(res.body.data).toMatchObject({ name: `Renamed ${tag}`, city: 'Mumbai', inviteCode: society.inviteCode });
    await as(adminToken).patch(`/admin/societies/${society.id}`, { city: null }).expect(400);
  });

  it('rotating the code: a new code; the old one is refused at the resident door; the new one works', async () => {
    const society = await createSociety(`Rotate ${tag}`);
    const res = await as(adminToken).post(`/admin/societies/${society.id}/invite-code`).expect(200);
    const rotated = res.body.data as AdminSocietyDetailDto;
    expect(rotated.inviteCode).not.toBe(society.inviteCode);
    expect(rotated.inviteCode).toMatch(/^[A-Z0-9]{8}$/);

    const phone = randomPhone();
    const old = await request(app.getHttpServer()).post('/auth/otp/request').send({ inviteCode: society.inviteCode, phone });
    expect(old.status).toBe(400);
    expect(old.body.error.code).toBe(ErrorCode.INVALID_INVITE_CODE);
    await request(app.getHttpServer()).post('/auth/otp/request').send({ inviteCode: rotated.inviteCode, phone }).expect(200);
  });

  it('deletes an empty society; refuses one with residents (409) and leaves it intact', async () => {
    const empty = await createSociety(`Empty ${tag}`);
    await as(adminToken).delete(`/admin/societies/${empty.id}`).expect(200);
    expect(await prisma.society.findUnique({ where: { id: empty.id } })).toBeNull();

    const busy = await as(adminToken).delete(`/admin/societies/${home.id}`).expect(409);
    expect(busy.body.error.code).toBe(ErrorCode.CONFLICT);
    expect(await prisma.resident.count({ where: { societyId: home.id } })).toBe(2);
    await as(adminToken).delete('/admin/societies/does-not-exist').expect(404);
  });
});
