import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import type { AdminResidentDto, Page } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Users and access rights (FEAT-033, ADR-0044): list every resident across societies
 * (search, society and role filters, paginated), rename, grant/revoke admin, remove —
 * with the self guards, the live-pledge guard, and sessions ending on removal.
 * The last-admin guard is unit-tested (the shared test DB always holds seeded admins).
 */
describe('Residents admin API (integration, needs DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let green: Society;
  let blue: Society;
  let admin: Resident;
  let asha: Resident;
  let farah: Resident;
  let adminToken: string;
  let ashaToken: string;
  const tag = randomInviteCode();
  const serviceIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    green = await prisma.society.create({ data: { name: `Users Green ${tag}`, city: 'Pune', inviteCode: randomInviteCode() } });
    blue = await prisma.society.create({ data: { name: `Users Blue ${tag}`, city: 'Mumbai', inviteCode: randomInviteCode() } });
    admin = await prisma.resident.create({ data: { societyId: green.id, phone: randomPhone(), name: `Admin ${tag}`, role: 'SUPER_ADMIN', verifiedAt: new Date() } });
    asha = await prisma.resident.create({ data: { societyId: green.id, phone: randomPhone(), name: `Asha ${tag}`, role: 'RESIDENT', verifiedAt: new Date() } });
    farah = await prisma.resident.create({ data: { societyId: blue.id, phone: randomPhone(), name: `Farah ${tag}`, role: 'RESIDENT', verifiedAt: new Date() } });
    adminToken = (await auth.issueTokens(admin)).accessToken;
    ashaToken = (await auth.issueTokens(asha)).accessToken;
  });

  afterAll(async () => {
    await prisma.society.deleteMany({ where: { id: { in: [green.id, blue.id] } } });
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await app.close();
  });

  const as = (token: string) => ({
    get: (path: string) => request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`),
    patch: (path: string, body: Record<string, unknown>) => request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${token}`).send(body),
    delete: (path: string) => request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${token}`),
  });

  async function pledge(resident: Resident, status: 'OPEN' | 'CANCELLED'): Promise<void> {
    const service = await prisma.service.create({
      data: { name: `Users svc ${serviceIds.length}`, slug: `users-${serviceIds.length}-${tag.toLowerCase()}`, description: 'x', category: 'Home Care', active: true },
    });
    serviceIds.push(service.id);
    await prisma.round.create({
      data: {
        societyId: resident.societyId!,
        serviceId: service.id,
        status,
        unitsCount: 1,
        deadline: new Date(Date.now() + 86_400_000),
        tiers: { create: [{ threshold: 2, price: 900 }] },
        participants: { create: [{ residentId: resident.id, units: 1 }] },
      },
    });
  }

  it('a resident gets 403', async () => {
    await as(ashaToken).get('/admin/residents').expect(403);
    await as(ashaToken).patch(`/admin/residents/${farah.id}`, { role: 'SUPER_ADMIN' }).expect(403);
    await as(ashaToken).delete(`/admin/residents/${farah.id}`).expect(403);
  });

  it('lists residents across societies, with society and live pledge count', async () => {
    const res = await as(adminToken).get(`/admin/residents?q=${encodeURIComponent(tag)}&limit=50`).expect(200);
    const page = res.body.data as Page<AdminResidentDto>;
    const names = page.items.map((r) => r.name).sort();
    expect(names).toEqual([`Admin ${tag}`, `Asha ${tag}`, `Farah ${tag}`].sort());
    expect(page.total).toBe(3);
    const f = page.items.find((r) => r.id === farah.id)!;
    expect(f).toMatchObject({ role: 'RESIDENT', society: { id: blue.id, name: `Users Blue ${tag}` }, pledgeCount: 0, phone: farah.phone });
  });

  it('filters by society, by role, and searches by phone', async () => {
    const bySociety = (await as(adminToken).get(`/admin/residents?societyId=${blue.id}`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(bySociety.items.map((r) => r.id)).toEqual([farah.id]);
    const admins = (await as(adminToken).get(`/admin/residents?role=SUPER_ADMIN&q=${encodeURIComponent(tag)}`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(admins.items.map((r) => r.id)).toEqual([admin.id]);
    const byPhone = (await as(adminToken).get(`/admin/residents?q=${encodeURIComponent(asha.phone.slice(-6))}&societyId=${green.id}`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(byPhone.items.map((r) => r.id)).toEqual([asha.id]);
    await as(adminToken).get('/admin/residents?role=GOD').expect(400);
  });

  it('paginates', async () => {
    const first = (await as(adminToken).get(`/admin/residents?q=${encodeURIComponent(tag)}&limit=2`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = (await as(adminToken).get(`/admin/residents?q=${encodeURIComponent(tag)}&limit=2&cursor=${first.nextCursor}`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('renames, clears a name, grants and revokes admin', async () => {
    const renamed = (await as(adminToken).patch(`/admin/residents/${farah.id}`, { name: `  Farah K ${tag} ` }).expect(200)).body.data as AdminResidentDto;
    expect(renamed.name).toBe(`Farah K ${tag}`);
    const promoted = (await as(adminToken).patch(`/admin/residents/${farah.id}`, { role: 'SUPER_ADMIN' }).expect(200)).body.data as AdminResidentDto;
    expect(promoted.role).toBe('SUPER_ADMIN');
    const demoted = (await as(adminToken).patch(`/admin/residents/${farah.id}`, { role: 'RESIDENT', name: null }).expect(200)).body.data as AdminResidentDto;
    expect(demoted).toMatchObject({ role: 'RESIDENT', name: null });
    await as(adminToken).patch(`/admin/residents/${farah.id}`, { role: 'OWNER' }).expect(400);
    await as(adminToken).patch('/admin/residents/nope', { name: 'x' }).expect(404);
  });

  it('an admin cannot change their own role (409), but can rename themselves', async () => {
    const res = await as(adminToken).patch(`/admin/residents/${admin.id}`, { role: 'RESIDENT' }).expect(409);
    expect(res.body.error.code).toBe(ErrorCode.CONFLICT);
    await as(adminToken).patch(`/admin/residents/${admin.id}`, { name: `Admin ${tag}` }).expect(200);
  });

  it('a promoted resident becomes an admin at their next token refresh', async () => {
    const tokens = await auth.issueTokens(asha);
    await as(adminToken).patch(`/admin/residents/${asha.id}`, { role: 'SUPER_ADMIN' }).expect(200);
    const refreshed = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(200);
    await as(refreshed.body.data.accessToken).get('/admin/residents').expect(200);
    await as(adminToken).patch(`/admin/residents/${asha.id}`, { role: 'RESIDENT' }).expect(200);
  });

  it('a dash-only search does not match everyone (V2 P3)', async () => {
    const res = (await as(adminToken).get(`/admin/residents?q=${encodeURIComponent(' - ')}&societyId=${green.id}`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(res.total).toBe(0);
  });

  it('refuses to remove yourself, or someone with a live pledge; a cancelled round does not count', async () => {
    await as(adminToken).delete(`/admin/residents/${admin.id}`).expect(409);
    await pledge(asha, 'OPEN');
    const busy = await as(adminToken).delete(`/admin/residents/${asha.id}`).expect(409);
    expect(busy.body.error.message).toMatch(/1 pledge.*deactivate them instead/);
    expect(await prisma.resident.findUnique({ where: { id: asha.id } })).not.toBeNull();

    await pledge(farah, 'CANCELLED');
    const list = (await as(adminToken).get(`/admin/residents?societyId=${blue.id}`).expect(200)).body.data as Page<AdminResidentDto>;
    expect(list.items[0].pledgeCount).toBe(0);
  });

  it('removes a resident and ends their sessions', async () => {
    const tokens = await auth.issueTokens(farah);
    await as(adminToken).delete(`/admin/residents/${farah.id}`).expect(200);
    expect(await prisma.resident.findUnique({ where: { id: farah.id } })).toBeNull();
    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    await as(adminToken).delete(`/admin/residents/${farah.id}`).expect(404);
  });
});
