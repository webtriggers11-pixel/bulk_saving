import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import type { AdminSocietyDetailDto, Page } from '@bulk/shared';
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

  /** FEAT-043: the address every create now needs. */
  const ADDRESS = { addressLine1: 'Plot 4, Link Road', state: 'Maharashtra', pincode: '400053' };

  async function createSociety(name: string): Promise<AdminSocietyDetailDto> {
    const res = await as(adminToken).post('/admin/societies', { name, city: '  Mumbai ', ...ADDRESS }).expect(201);
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
    const res = await as(adminToken).post('/admin/societies', { name: `Chosen ${tag}`, city: 'Pune', ...ADDRESS, inviteCode: 'AAAAAAAA' }).expect(201);
    created.push(res.body.data.id);
    expect(res.body.data.inviteCode).not.toBe('AAAAAAAA');
  });

  it('validates name and city', async () => {
    await as(adminToken).post('/admin/societies', { name: ' ', city: 'Pune', ...ADDRESS }).expect(400);
    await as(adminToken).post('/admin/societies', { name: 'Okay name', city: '', ...ADDRESS }).expect(400);
    await as(adminToken).post('/admin/societies', { name: 'x'.repeat(81), city: 'Pune', ...ADDRESS }).expect(400);
  });

  it('lists societies with resident and round counts (searched; FEAT-044 pages)', async () => {
    const res = await as(adminToken).get(`/admin/societies?q=${encodeURIComponent(`Societies Admin ${tag}`)}`).expect(200);
    const mine = (res.body.data as Page<AdminSocietyDetailDto>).items.find((s) => s.id === home.id);
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
  describe('address and contact phone (FEAT-043)', () => {
    it('create stores the full address and canonicalises an optional phone', async () => {
      const res = await as(adminToken)
        .post('/admin/societies', {
          name: `Addressed ${tag}`,
          city: 'Pune',
          addressLine1: '  Plot 12, Baner Road ',
          addressLine2: 'Baner',
          landmark: '  ',
          state: 'Maharashtra',
          pincode: '411045',
          contactPhone: '098765 43210',
        })
        .expect(201);
      const s = res.body.data as AdminSocietyDetailDto;
      created.push(s.id);
      expect(s).toMatchObject({
        addressLine1: 'Plot 12, Baner Road',
        addressLine2: 'Baner',
        landmark: null,
        state: 'Maharashtra',
        pincode: '411045',
        contactPhone: '+919876543210',
      });
      const detail = (await as(adminToken).get(`/admin/societies/${s.id}`).expect(200)).body.data as AdminSocietyDetailDto;
      expect(detail.contactPhone).toBe('+919876543210');
    });

    it('the phone is optional: omitted or blank stores null', async () => {
      const a = (await as(adminToken).post('/admin/societies', { name: `No phone ${tag}`, city: 'Pune', ...ADDRESS }).expect(201)).body.data as AdminSocietyDetailDto;
      const b = (await as(adminToken).post('/admin/societies', { name: `Blank phone ${tag}`, city: 'Pune', ...ADDRESS, contactPhone: '' }).expect(201)).body.data as AdminSocietyDetailDto;
      created.push(a.id, b.id);
      expect(a.contactPhone).toBeNull();
      expect(b.contactPhone).toBeNull();
    });

    it('create refuses a missing or bad address line, state, pincode or phone with 400', async () => {
      const base = { name: `Bad ${tag}`, city: 'Pune', ...ADDRESS };
      const bad: Record<string, unknown>[] = [
        { addressLine1: undefined },
        { addressLine1: '  ' },
        { state: undefined },
        { state: 'Atlantis' },
        { pincode: undefined },
        { pincode: '41104' },
        { pincode: '011045' },
        { pincode: '41104a' },
        { contactPhone: '12345' },
        { contactPhone: '+14155550100' },
        { contactPhone: '5876543210' },
      ];
      for (const patch of bad) {
        const res = await as(adminToken).post('/admin/societies', { ...base, ...patch });
        expect({ patch, status: res.status }).toEqual({ patch, status: 400 });
        expect(res.body.success).toBe(false);
      }
    });

    it('edit fills in an old society, clears optional parts, and refuses clearing required ones', async () => {
      const old = await prisma.society.create({ data: { name: `Old ${tag}`, city: 'Pune', inviteCode: randomInviteCode() } });
      created.push(old.id);
      const before = (await as(adminToken).get(`/admin/societies/${old.id}`).expect(200)).body.data as AdminSocietyDetailDto;
      expect(before).toMatchObject({ addressLine1: null, state: null, pincode: null, contactPhone: null });

      // V2 P2-2: part of an address on an address-less society is refused.
      const half = await as(adminToken).patch(`/admin/societies/${old.id}`, { addressLine1: 'Tower B' }).expect(400);
      expect(half.body.error.message).toMatch(/set together/);

      const filled = (
        await as(adminToken)
          .patch(`/admin/societies/${old.id}`, { addressLine1: 'Tower B, MG Road', landmark: 'Metro station', state: 'Karnataka', pincode: '560001', contactPhone: '+91 99999 00111' })
          .expect(200)
      ).body.data as AdminSocietyDetailDto;
      expect(filled).toMatchObject({ addressLine1: 'Tower B, MG Road', landmark: 'Metro station', state: 'Karnataka', pincode: '560001', contactPhone: '+919999900111' });

      // Once complete, one part can change alone.
      await as(adminToken).patch(`/admin/societies/${old.id}`, { pincode: '560002' }).expect(200);

      const cleared = (await as(adminToken).patch(`/admin/societies/${old.id}`, { landmark: '', contactPhone: null }).expect(200)).body.data as AdminSocietyDetailDto;
      expect(cleared).toMatchObject({ landmark: null, contactPhone: null, addressLine1: 'Tower B, MG Road' });

      for (const patch of [{ addressLine1: null }, { addressLine1: '' }, { state: null }, { pincode: '' }, { pincode: '12' }, { contactPhone: 'call me' }]) {
        const res = await as(adminToken).patch(`/admin/societies/${old.id}`, patch);
        expect({ patch, status: res.status }).toEqual({ patch, status: 400 });
      }
    });
  });
});
