import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Service, Society } from '@prisma/client';
import type { ServiceDto } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Catalog read (FEAT-002 T3). `GET /catalog` returns the CALLER'S society's
 * enabled offerings ⋈ active services, scoped by the JWT societyId only. The
 * tenant-isolation case (a Society A resident never sees a B-only service) is
 * the highest-risk assertion. Needs DB + Redis.
 */
describe('GET /catalog (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let societyA: Society;
  let societyB: Society;
  let residentA: Resident;
  let tokenA: string;
  // Services (global master)
  let acServicing: Service; // active, enabled for A (with indicative price)
  let pestControl: Service; // active, enabled for A (no indicative price)
  let painting: Service; // active, but offering DISABLED for A -> excluded
  let inactive: Service; // enabled offering for A but service INACTIVE -> excluded
  let bOnly: Service; // active, enabled for B ONLY -> A must never see it

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    societyA = await prisma.society.create({
      data: { name: 'Catalog A', city: 'Pune', inviteCode: randomInviteCode() },
    });
    societyB = await prisma.society.create({
      data: { name: 'Catalog B', city: 'Mumbai', inviteCode: randomInviteCode() },
    });
    residentA = await prisma.resident.create({
      data: { societyId: societyA.id, phone: randomPhone(), verifiedAt: new Date() },
    });
    tokenA = (await auth.issueTokens(residentA)).accessToken;

    const s = randomInviteCode().toLowerCase();
    acServicing = await prisma.service.create({
      data: {
        name: 'AC Servicing',
        slug: `ac-${s}`,
        description: 'Split & window AC service',
        category: 'Appliances',
        imageUrl: 'https://cdn.example.com/ac.png',
        active: true,
      },
    });
    pestControl = await prisma.service.create({
      data: {
        name: 'Pest Control',
        slug: `pest-${s}`,
        description: 'General pest treatment',
        category: 'Home Care',
        active: true,
      },
    });
    painting = await prisma.service.create({
      data: { name: 'Painting', slug: `paint-${s}`, description: 'Interior painting', category: 'Home Care', active: true },
    });
    inactive = await prisma.service.create({
      data: { name: 'Retired', slug: `old-${s}`, description: 'Discontinued', category: 'Home Care', active: false },
    });
    bOnly = await prisma.service.create({
      data: { name: 'B Only Wash', slug: `bwash-${s}`, description: 'Bathroom wash', category: 'Home Care', active: true },
    });

    // Society A: AC (enabled, priced), Pest (enabled), Painting (DISABLED),
    // Retired (enabled offering but inactive service).
    await prisma.serviceOffering.createMany({
      data: [
        { societyId: societyA.id, serviceId: acServicing.id, enabled: true, indicativePrice: 1499 },
        { societyId: societyA.id, serviceId: pestControl.id, enabled: true },
        { societyId: societyA.id, serviceId: painting.id, enabled: false },
        { societyId: societyA.id, serviceId: inactive.id, enabled: true },
        // Society B: bOnly (enabled). A must never see this.
        { societyId: societyB.id, serviceId: bOnly.id, enabled: true, indicativePrice: 299 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.serviceOffering.deleteMany({
      where: { societyId: { in: [societyA.id, societyB.id] } },
    });
    await prisma.service.deleteMany({
      where: { id: { in: [acServicing.id, pestControl.id, painting.id, inactive.id, bOnly.id] } },
    });
    await prisma.society.deleteMany({ where: { id: { in: [societyA.id, societyB.id] } } });
    await app.close();
  });

  it('returns the society enabled+active services with correct fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const data = res.body.data.items as ServiceDto[];
    const slugs = data.map((d) => d.slug).sort();
    expect(slugs).toEqual([acServicing.slug, pestControl.slug].sort());

    const ac = data.find((d) => d.slug === acServicing.slug);
    expect(ac).toMatchObject({
      id: acServicing.id,
      name: 'AC Servicing',
      description: 'Split & window AC service',
      category: 'Appliances',
      imageUrl: 'https://cdn.example.com/ac.png',
      indicativePrice: 1499,
    });

    // No indicative price set for pest control -> field omitted entirely.
    const pest = data.find((d) => d.slug === pestControl.slug);
    expect(pest).toBeDefined();
    expect(pest).not.toHaveProperty('indicativePrice');
    expect(pest).not.toHaveProperty('imageUrl');
  });

  it('excludes disabled offerings and inactive services', async () => {
    const res = await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const slugs = (res.body.data.items as ServiceDto[]).map((d) => d.slug);
    expect(slugs).not.toContain(painting.slug); // offering disabled
    expect(slugs).not.toContain(inactive.slug); // service inactive
  });

  it('TENANT ISOLATION: a Society A resident never sees a B-only service', async () => {
    // The B-only offering genuinely exists and is enabled...
    const bExists = await prisma.serviceOffering.findUnique({
      where: { societyId_serviceId: { societyId: societyB.id, serviceId: bOnly.id } },
    });
    expect(bExists?.enabled).toBe(true);

    // ...but it must be invisible to a Society A caller.
    const res = await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const slugs = (res.body.data.items as ServiceDto[]).map((d) => d.slug);
    expect(slugs).not.toContain(bOnly.slug);
  });

  it('rejects an unauthenticated request with 401', async () => {
    await request(app.getHttpServer()).get('/catalog').expect(401);
  });
});
