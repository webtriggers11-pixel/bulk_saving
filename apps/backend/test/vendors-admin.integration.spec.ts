import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import type { VendorDto } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Vendors admin API (FEAT-005 T3/T7, ADR-0012). `GET/POST /admin/vendors` and
 * `PATCH /admin/vendors/:id`: validated DTOs (name 1–100 trimmed, phone 8–15 digits
 * with optional +, category ≤100, notes ≤500, null clears on PATCH), list ordered
 * active first then name, unknown id → 404, resident token → 403. The vendor table is
 * global and shared with parallel suites, so assertions only look at this suite's rows.
 */
describe('Vendors admin API (integration, needs DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let society: Society;
  let admin: Resident;
  let resident: Resident;
  let adminToken: string;
  let residentToken: string;
  const createdIds: string[] = [];
  const suffix = randomInviteCode();

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);

    society = await prisma.society.create({
      data: { name: `Vendors Admin ${suffix}`, city: 'Pune', inviteCode: randomInviteCode() },
    });
    admin = await prisma.resident.create({
      data: {
        societyId: society.id,
        phone: randomPhone(),
        role: 'SUPER_ADMIN',
        verifiedAt: new Date(),
      },
    });
    resident = await prisma.resident.create({
      data: {
        societyId: society.id,
        phone: randomPhone(),
        role: 'RESIDENT',
        verifiedAt: new Date(),
      },
    });
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentToken = (await auth.issueTokens(resident)).accessToken;
  });

  afterAll(async () => {
    await prisma.vendor.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
  });

  const post = (body: Record<string, unknown>, token = adminToken): request.Test =>
    request(app.getHttpServer())
      .post('/admin/vendors')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const patch = (id: string, body: Record<string, unknown>, token = adminToken): request.Test =>
    request(app.getHttpServer())
      .patch(`/admin/vendors/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('creates a vendor (201), trimming the name, active by default', async () => {
    const res = await post({
      name: `  FEAT5 Beta ${suffix}  `,
      phone: '+919812345678',
      category: 'Appliances',
      notes: 'Reliable AC team',
    }).expect(201);
    const vendor = res.body.data as VendorDto;
    createdIds.push(vendor.id);
    expect(vendor).toMatchObject({
      name: `FEAT5 Beta ${suffix}`,
      phone: '+919812345678',
      category: 'Appliances',
      notes: 'Reliable AC team',
      active: true,
    });
    expect(typeof vendor.createdAt).toBe('string');

    const minimal = await post({ name: `FEAT5 Alpha ${suffix}`, phone: '98123456' }).expect(201);
    const alpha = minimal.body.data as VendorDto;
    createdIds.push(alpha.id);
    expect(alpha.category).toBeNull();
    expect(alpha.notes).toBeNull();
  });

  it.each<[string, Record<string, unknown>]>([
    ['missing name', { phone: '+919812345678' }],
    ['whitespace-only name', { name: '   ', phone: '+919812345678' }],
    ['name over 100 chars', { name: 'x'.repeat(101), phone: '+919812345678' }],
    ['phone with letters', { name: 'V', phone: '98abc45678' }],
    ['phone too short', { name: 'V', phone: '1234567' }],
    ['phone too long', { name: 'V', phone: '+1234567890123456' }],
    ['category over 100 chars', { name: 'V', phone: '98123456', category: 'c'.repeat(101) }],
    ['notes over 500 chars', { name: 'V', phone: '98123456', notes: 'n'.repeat(501) }],
  ])('rejects %s with 400', async (_label, body) => {
    await post(body).expect(400);
  });

  it('lists vendors active first, then by name (GET 200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const list = res.body.data as VendorDto[];
    // Globally: no active vendor appears after an inactive one.
    const firstInactive = list.findIndex((v) => !v.active);
    if (firstInactive >= 0) {
      expect(list.slice(firstInactive).every((v) => !v.active)).toBe(true);
    }
    // This suite's two active vendors are in name order (Alpha before Beta).
    const mine = list.filter((v) => createdIds.includes(v.id)).map((v) => v.name);
    expect(mine).toEqual([`FEAT5 Alpha ${suffix}`, `FEAT5 Beta ${suffix}`]);
  });

  it('updates fields, clears nullable fields with null, and deactivates (PATCH 200)', async () => {
    const [betaId] = createdIds;
    const res = await patch(betaId, {
      name: `FEAT5 Beta Renamed ${suffix}`,
      phone: '9800011122',
      category: null,
      notes: null,
      active: false,
    }).expect(200);
    const vendor = res.body.data as VendorDto;
    expect(vendor).toMatchObject({
      id: betaId,
      name: `FEAT5 Beta Renamed ${suffix}`,
      phone: '9800011122',
      category: null,
      notes: null,
      active: false,
    });

    // A partial patch leaves other fields untouched.
    const partial = await patch(betaId, { notes: 'Back in town' }).expect(200);
    expect(partial.body.data as VendorDto).toMatchObject({
      name: `FEAT5 Beta Renamed ${suffix}`,
      notes: 'Back in town',
      active: false,
    });

    // Now inactive, it sorts after the active Alpha.
    const list = await request(app.getHttpServer())
      .get('/admin/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const mine = (list.body.data as VendorDto[]).filter((v) => createdIds.includes(v.id));
    expect(mine.map((v) => v.id)).toEqual([createdIds[1], betaId]);
  });

  it('rejects an invalid PATCH body with 400', async () => {
    await patch(createdIds[0], { phone: 'not-a-phone' }).expect(400);
    await patch(createdIds[0], { name: '' }).expect(400);
    await patch(createdIds[0], { active: 'yes' }).expect(400);
    // null is only valid for the nullable fields (category/notes), never a 500.
    await patch(createdIds[0], { name: null }).expect(400);
    await patch(createdIds[0], { phone: null }).expect(400);
    await patch(createdIds[0], { active: null }).expect(400);
  });

  it('returns 404 NOT_FOUND patching an unknown vendor', async () => {
    const res = await patch('does-not-exist', { name: 'X' }).expect(404);
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('DENIES every vendor route to a RESIDENT token with 403', async () => {
    await request(app.getHttpServer())
      .get('/admin/vendors')
      .set('Authorization', `Bearer ${residentToken}`)
      .expect(403);
    await post({ name: 'Nope', phone: '98123456' }, residentToken).expect(403);
    await patch(createdIds[0], { name: 'Nope' }, residentToken).expect(403);
  });
});
