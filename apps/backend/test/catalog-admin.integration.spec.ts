import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MAX_UNIT_LABEL, SERVICE_CATEGORIES } from '@bulk/shared';
import type { Resident, Society } from '@prisma/client';
import type { AdminServiceDto, ServiceOfferingDto } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Super-admin catalog management API (FEAT-002 T4/T5). Master-service CRUD and
 * per-society offering upserts are SUPER_ADMIN-only; a resident token gets 403.
 * Duplicate slugs are rejected with SERVICE_SLUG_TAKEN. Needs DB + Redis.
 */
describe('Admin catalog API (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let society: Society;
  let admin: Resident;
  let resident: Resident;
  let adminToken: string;
  let residentToken: string;
  const createdServiceIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    society = await prisma.society.create({
      data: { name: 'Admin Society', city: 'Pune', inviteCode: randomInviteCode() },
    });
    admin = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() },
    });
    resident = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() },
    });
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentToken = (await auth.issueTokens(resident)).accessToken;
  });

  afterAll(async () => {
    await prisma.serviceOffering.deleteMany({ where: { societyId: society.id } });
    await prisma.service.deleteMany({
      where: { OR: [{ id: { in: createdServiceIds } }, { slug: { in: issuedSlugs } }] },
    });
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
  });

  // Every slug handed out is remembered and cleaned up in afterAll, whether or not the
  // test registered the id — three FEAT-010 tests did not, and each run left three
  // services in the shared dev catalog (FEAT-014's browser pass found 34).
  const issuedSlugs: string[] = [];
  const uniqueSlug = (): string => {
    const slug = `svc-${randomInviteCode().toLowerCase()}`;
    issuedSlugs.push(slug);
    return slug;
  };

  it('creates a master service (SUPER_ADMIN)', async () => {
    const slug = uniqueSlug();
    const res = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Deep Cleaning', slug, description: 'Full home deep clean', category: 'Home Care' })
      .expect(201);
    const svc = res.body.data as AdminServiceDto;
    createdServiceIds.push(svc.id);
    expect(svc).toMatchObject({ name: 'Deep Cleaning', slug, category: 'Home Care', active: true, imageUrl: null });
  });

  it('rejects a duplicate slug with 409 SERVICE_SLUG_TAKEN', async () => {
    const slug = uniqueSlug();
    const first = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'First', slug, description: 'x', category: 'Home Care' })
      .expect(201);
    createdServiceIds.push((first.body.data as AdminServiceDto).id);

    const dup = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Second', slug, description: 'y', category: 'Home Care' })
      .expect(409);
    expect(dup.body.error.code).toBe(ErrorCode.SERVICE_SLUG_TAKEN);
  });

  it('lists all master services (SUPER_ADMIN)', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const services = res.body.data as AdminServiceDto[];
    expect(Array.isArray(services)).toBe(true);
    expect(services.some((svc) => createdServiceIds.includes(svc.id))).toBe(true);
  });

  it('updates a service and toggles active (SUPER_ADMIN)', async () => {
    const slug = uniqueSlug();
    const created = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Toggle Me', slug, description: 'x', category: 'Home Care' })
      .expect(201);
    const id = (created.body.data as AdminServiceDto).id;
    createdServiceIds.push(id);

    const res = await request(app.getHttpServer())
      .patch(`/admin/services/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false, category: 'Appliances' })
      .expect(200);
    const svc = res.body.data as AdminServiceDto;
    expect(svc.active).toBe(false);
    expect(svc.category).toBe('Appliances');
  });

  it('upserts a per-society offering (SUPER_ADMIN)', async () => {
    const slug = uniqueSlug();
    const created = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Offerable', slug, description: 'x', category: 'Home Care' })
      .expect(201);
    const serviceId = (created.body.data as AdminServiceDto).id;
    createdServiceIds.push(serviceId);

    // Enable with a price...
    const enabled = await request(app.getHttpServer())
      .put(`/admin/societies/${society.id}/offerings/${serviceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, indicativePrice: 999 })
      .expect(200);
    expect(enabled.body.data as ServiceOfferingDto).toMatchObject({
      societyId: society.id,
      serviceId,
      enabled: true,
      indicativePrice: 999,
    });

    // ...then disable (idempotent upsert on the same unique pair).
    const disabled = await request(app.getHttpServer())
      .put(`/admin/societies/${society.id}/offerings/${serviceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: false })
      .expect(200);
    expect((disabled.body.data as ServiceOfferingDto).enabled).toBe(false);

    const rows = await prisma.serviceOffering.findMany({ where: { societyId: society.id, serviceId } });
    expect(rows).toHaveLength(1); // upsert, not duplicate insert
  });

  it('DENIES all admin catalog routes to a RESIDENT token with 403', async () => {
    await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ name: 'Nope', slug: uniqueSlug(), description: 'x', category: 'Home Care' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/admin/services')
      .set('Authorization', `Bearer ${residentToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch('/admin/services/some-id')
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ active: false })
      .expect(403);
    await request(app.getHttpServer())
      .put(`/admin/societies/${society.id}/offerings/whatever`)
      .set('Authorization', `Bearer ${residentToken}`)
      .send({ enabled: true })
      .expect(403);
  });

  it('returns 404 when updating an unknown service (SUPER_ADMIN, not-found path)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/admin/services/does-not-exist')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false })
      .expect(404);
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('returns 404 when upserting an offering for an unknown society', async () => {
    const slug = uniqueSlug();
    const created = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'For Missing Society', slug, description: 'x', category: 'Home Care' })
      .expect(201);
    createdServiceIds.push((created.body.data as AdminServiceDto).id);

    const res = await request(app.getHttpServer())
      .put(`/admin/societies/does-not-exist/offerings/${(created.body.data as AdminServiceDto).id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true })
      .expect(404);
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('returns 404 when upserting an offering for an unknown service', async () => {
    const res = await request(app.getHttpServer())
      .put(`/admin/societies/${society.id}/offerings/does-not-exist`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true })
      .expect(404);
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('rejects invalid create payloads via DTO validation (400)', async () => {
    await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', slug: 'Bad Slug!', description: 'x', category: 'Home Care' })
      .expect(400);
  });

  describe('closed category list (FEAT-014, ADR-0025)', () => {
    it('accepts every listed category, including the Bulk Staples pilot', async () => {
      for (const category of SERVICE_CATEGORIES) {
        const res = await request(app.getHttpServer())
          .post('/admin/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: `In ${category}`, slug: uniqueSlug(), description: 'x', category })
          .expect(201);
        createdServiceIds.push((res.body.data as AdminServiceDto).id);
        expect(res.body.data.category).toBe(category);
      }
    });

    it('REFUSES a category outside the list on create — "Home" is how "Home Care" splits in two', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Typo', slug: uniqueSlug(), description: 'x', category: 'Home' })
        .expect(400);
      expect(res.body.error.code).toBe(ErrorCode.BAD_REQUEST);
      // The message names the valid choices, so the admin can correct it.
      expect(res.body.error.message).toContain('Bulk Staples');
      // Case matters too: "home care" is a different catalog section from "Home Care".
      await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Case', slug: uniqueSlug(), description: 'x', category: 'home care' })
        .expect(400);
    });

    it('REFUSES an unlisted category on PATCH, and leaves the service unchanged', async () => {
      const created = await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Keep', slug: uniqueSlug(), description: 'x', category: 'Utilities' })
        .expect(201);
      const id = (created.body.data as AdminServiceDto).id;
      createdServiceIds.push(id);

      await request(app.getHttpServer())
        .patch(`/admin/services/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'Groceries' })
        .expect(400);
      const row = await prisma.service.findUniqueOrThrow({ where: { id } });
      expect(row.category).toBe('Utilities');
    });

    it('still lets a service written before the list existed be edited without its category', async () => {
      // A pre-ADR-0025 row: the column is a plain string, so this is reachable.
      const legacy = await prisma.service.create({
        data: { name: 'Legacy', slug: uniqueSlug(), description: 'x', category: 'Home' },
      });
      createdServiceIds.push(legacy.id);
      const res = await request(app.getHttpServer())
        .patch(`/admin/services/${legacy.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(200);
      expect(res.body.data).toMatchObject({ category: 'Home', active: false });
    });
  });

  it('lists each service with its per-society offerings (FEAT-014)', async () => {
    const created = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Offered', slug: uniqueSlug(), description: 'x', category: 'Vehicle' })
      .expect(201);
    const id = (created.body.data as AdminServiceDto).id;
    createdServiceIds.push(id);
    expect(created.body.data.offerings).toEqual([]);

    await request(app.getHttpServer())
      .put(`/admin/societies/${society.id}/offerings/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled: true, indicativePrice: 299 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const svc = (res.body.data as AdminServiceDto[]).find((s) => s.id === id);
    expect(svc?.offerings).toEqual([
      expect.objectContaining({ societyId: society.id, serviceId: id, enabled: true, indicativePrice: 299 }),
    ]);
  });

  describe('unit labels (FEAT-010, V2 P1-D)', () => {
    it('stores a trimmed label pair and the scope sentence', async () => {
      const slug = uniqueSlug();
      const res = await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Wall Painting',
          slug,
          description: 'Interior painting',
          category: 'Renovation',
          unitLabel: '  room  ',
          unitLabelPlural: ' rooms ',
          unitDescription: '  One room, walls only.  ',
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        unitLabel: 'room',
        unitLabelPlural: 'rooms',
        unitDescription: 'One room, walls only.',
      });
    });

    it('defaults to unit/units when the labels are omitted', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Unlabelled', slug: uniqueSlug(), description: 'x', category: 'Home Care' })
        .expect(201);

      expect(res.body.data).toMatchObject({ unitLabel: 'unit', unitLabelPlural: 'units' });
    });

    it('REFUSES a singular without its plural — the "1 room / 2 units" split', async () => {
      // Supplying one alone left the other at its default, so a service counted in
      // rooms rendered "1 room" and "2 units", and its SMS "3 units at ₹3500/room".
      // Deriving the missing side by appending "s" is what ADR-0019 rejected, so this
      // is refused rather than guessed.
      const res = await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Half', slug: uniqueSlug(), description: 'x', category: 'Home Care', unitLabel: 'room' })
        .expect(400);

      expect(res.body.error.message).toContain('together');
    });

    it('REFUSES a plural without its singular, and the same on PATCH', async () => {
      const slug = uniqueSlug();
      await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Half2', slug, description: 'x', category: 'Home Care', unitLabelPlural: 'rooms' })
        .expect(400);

      const created = await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Paired', slug: uniqueSlug(), description: 'x', category: 'Home Care' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/admin/services/${created.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ unitLabel: 'room' })
        .expect(400);
    });

    it('rejects a label longer than the cap', async () => {
      await request(app.getHttpServer())
        .post('/admin/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TooLong',
          slug: uniqueSlug(),
          description: 'x',
          category: 'Home Care',
          unitLabel: 'x'.repeat(MAX_UNIT_LABEL + 1),
          unitLabelPlural: 'xs',
        })
        .expect(400);
    });
  });
});
