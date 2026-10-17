import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Service, Society, Vendor } from '@prisma/client';
import { MAX_SEARCH } from '@bulk/shared';
import type { AdminRoundSummaryDto, AdminServiceDto, ServiceDto, VendorDto } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * FEAT-015 (ADR-0026): every list filters on the server. The dev DB is shared with the
 * seed and other suites, so nothing here assumes an empty table — every assertion is
 * scoped by a token unique to this run, and everything created is removed in afterAll.
 */
describe('List filters (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let societyA: Society;
  let societyB: Society;
  let adminToken: string;
  let residentAToken: string;
  // Unique per run, lower-case so the case-insensitive assertions mean something.
  const token = `zq${randomInviteCode().toLowerCase()}`;
  const TOKEN = token.toUpperCase();
  // Slugs carry their own prefix, NOT the token: search covers slugs, so a token in every
  // slug would make every service match (which is how this test first failed).
  const slugPrefix = `lf${randomInviteCode().toLowerCase()}`;
  const services: Service[] = [];
  const vendors: Vendor[] = [];

  const server = () => app.getHttpServer();
  const get = (path: string, auth = adminToken) => request(server()).get(path).set('Authorization', `Bearer ${auth}`);

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);

    societyA = await prisma.society.create({ data: { name: `Alpha ${token}`, city: 'Pune', inviteCode: randomInviteCode() } });
    societyB = await prisma.society.create({ data: { name: 'Beta Heights', city: 'Pune', inviteCode: randomInviteCode() } });
    const admin: Resident = await prisma.resident.create({
      data: { societyId: societyA.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() },
    });
    const resident: Resident = await prisma.resident.create({
      data: { societyId: societyA.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() },
    });
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentAToken = (await auth.issueTokens(resident)).accessToken;

    const make = async (name: string, category: string, active = true, description = 'x') => {
      const svc = await prisma.service.create({
        data: { name, slug: `${slugPrefix}-${services.length}`, description, category, active },
      });
      services.push(svc);
      return svc;
    };
    // [0] tank — offered in A; [1] car wash — description carries the token, offered in B only;
    // [2] rice — inactive; [3] a plain service with no token at all.
    const tank = await make(`Tank ${TOKEN} Clean`, 'Utilities');
    const wash = await make('Car Wash', 'Vehicle', true, `Foam wash ${token}`);
    await make(`Rice ${token}`, 'Bulk Staples', false);
    const plain = await make('Plain Service', 'Utilities');
    await prisma.serviceOffering.createMany({
      data: [
        { societyId: societyA.id, serviceId: tank.id, enabled: true },
        { societyId: societyB.id, serviceId: wash.id, enabled: true },
        // Present but switched OFF in A: offeredIn must not count it.
        { societyId: societyA.id, serviceId: plain.id, enabled: false },
      ],
    });

    vendors.push(
      await prisma.vendor.create({ data: { name: `Aqua ${TOKEN}`, phone: '+919000000001', category: 'Utilities' } }),
      await prisma.vendor.create({ data: { name: 'Shine Co', phone: `+9190${Date.now() % 1e8}`, category: 'home care', notes: `ask for ${token}` } }),
      await prisma.vendor.create({ data: { name: `Gone ${token}`, phone: '+919000000003', category: 'Vehicle', active: false } }),
    );

    // Rounds: one in A for the tank (vendor Aqua), one in B for the car wash.
    await prisma.round.create({
      data: {
        societyId: societyA.id, serviceId: tank.id, status: 'ASSIGNED', vendorId: vendors[0].id, finalPrice: 500,
        assignedAt: new Date(), deadline: new Date(), tiers: { create: [{ threshold: 1, price: 600 }] },
      },
    });
    await prisma.round.create({
      data: { societyId: societyB.id, serviceId: wash.id, deadline: new Date(Date.now() + 86_400_000), tiers: { create: [{ threshold: 5, price: 300 }] } },
    });
  });

  afterAll(async () => {
    // Societies cascade residents, offerings and rounds; then vendors (Restrict) and services.
    await prisma.society.deleteMany({ where: { id: { in: [societyA.id, societyB.id] } } });
    await prisma.vendor.deleteMany({ where: { id: { in: vendors.map((v) => v.id) } } });
    await prisma.service.deleteMany({ where: { slug: { startsWith: `${slugPrefix}-` } } });
    await app.close();
  });

  describe('GET /admin/services', () => {
    const names = async (qs: string) =>
      ((await get(`/admin/services${qs}`).expect(200)).body.data as AdminServiceDto[])
        .filter((s) => s.slug.startsWith(`${slugPrefix}-`))
        .map((s) => s.name)
        .sort();

    it('searches name and description, ignoring case', async () => {
      expect(await names(`?q=${TOKEN}`)).toEqual(['Car Wash', `Rice ${token}`, `Tank ${TOKEN} Clean`].sort());
    });

    it('narrows the WHOLE list, not just ours — every row returned matches', async () => {
      const all = (await get(`/admin/services?q=${token}`).expect(200)).body.data as AdminServiceDto[];
      expect(all.length).toBe(3);
    });

    it('searches the slug too', async () => {
      expect(await names(`?q=${slugPrefix}-3`)).toEqual(['Plain Service']);
    });

    it('treats a blank search as no search', async () => {
      const unfiltered = (await get('/admin/services').expect(200)).body.data.length;
      const blank = (await get('/admin/services?q=%20%20').expect(200)).body.data.length;
      expect(blank).toBe(unfiltered);
    });

    it('filters by category, status and offeredIn — and they combine', async () => {
      expect(await names('?category=Utilities')).toEqual(['Plain Service', `Tank ${TOKEN} Clean`]);
      expect(await names('?status=inactive')).toEqual([`Rice ${token}`]);
      expect(await names('?status=active&category=Utilities')).toEqual(['Plain Service', `Tank ${TOKEN} Clean`]);
      // Plain has an offering row in A, but switched off — it is not "offered in" A.
      expect(await names(`?offeredIn=${societyA.id}`)).toEqual([`Tank ${TOKEN} Clean`]);
      expect(await names(`?offeredIn=${societyB.id}&q=foam`)).toEqual(['Car Wash']);
    });

    it('refuses an unknown status and an over-long search with 400', async () => {
      await get('/admin/services?status=archived').expect(400);
      await get(`/admin/services?q=${'x'.repeat(MAX_SEARCH + 1)}`).expect(400);
    });

    it('is still SUPER_ADMIN-only', async () => {
      await get('/admin/services?q=x', residentAToken).expect(403);
    });
  });

  describe('GET /admin/vendors', () => {
    const names = async (qs: string) =>
      ((await get(`/admin/vendors${qs}`).expect(200)).body.data as VendorDto[])
        .filter((v) => vendors.some((mine) => mine.id === v.id))
        .map((v) => v.name)
        .sort();

    it('searches name and notes ignoring case, and phone by digits', async () => {
      expect(await names(`?q=${token}`)).toEqual([`Aqua ${TOKEN}`, `Gone ${token}`, 'Shine Co'].sort());
      expect(await names(`?q=${vendors[1].phone.slice(-6)}`)).toEqual(['Shine Co']);
    });

    it('matches a free-text vendor category regardless of case', async () => {
      expect(await names('?category=Home%20Care')).toEqual(['Shine Co']);
    });

    it('filters by status', async () => {
      expect(await names('?status=inactive')).toEqual([`Gone ${token}`]);
      await get('/admin/vendors?status=maybe').expect(400);
    });
  });

  describe('GET /admin/rounds', () => {
    const ours = async (qs: string) =>
      ((await get(`/admin/rounds${qs}`).expect(200)).body.data as AdminRoundSummaryDto[])
        .filter((r) => r.society.id === societyA.id || r.society.id === societyB.id)
        .map((r) => r.service.name)
        .sort();

    it('searches service, society and vendor name', async () => {
      // Matches the tank by service name AND society name; the car wash by neither.
      expect(await ours(`?q=${token}`)).toEqual([`Tank ${TOKEN} Clean`]);
      expect(await ours('?q=beta%20heights')).toEqual(['Car Wash']);
      expect(await ours(`?q=aqua%20${token}`)).toEqual([`Tank ${TOKEN} Clean`]);
    });

    it('filters by service category, combined with the existing filters', async () => {
      expect(await ours('?category=Vehicle')).toEqual(['Car Wash']);
      expect(await ours(`?category=Vehicle&societyId=${societyA.id}`)).toEqual([]);
      expect(await ours('?status=ASSIGNED&category=Utilities')).toEqual([`Tank ${TOKEN} Clean`]);
    });
  });

  describe('GET /catalog (resident)', () => {
    const names = async (qs: string) =>
      ((await get(`/catalog${qs}`, residentAToken).expect(200)).body.data as ServiceDto[]).map((s) => s.name).sort();

    it('searches within the caller’s society only — a match elsewhere never leaks', async () => {
      // "foam" is only in the car wash's description, and the car wash is offered in B.
      expect(await names('?q=foam')).toEqual([]);
      expect(await names(`?q=${token}`)).toEqual([`Tank ${TOKEN} Clean`]);
    });

    it('cannot be pointed at another society by query string', async () => {
      // Not a declared filter: whitelisting drops it, and the token's society still rules.
      expect(await names(`?societyId=${societyB.id}&q=foam`)).toEqual([]);
    });

    it('filters by category and still hides switched-off and inactive services', async () => {
      expect(await names('?category=Utilities')).toEqual([`Tank ${TOKEN} Clean`]);
      expect(await names('?category=Bulk%20Staples')).toEqual([]);
    });
  });
});
