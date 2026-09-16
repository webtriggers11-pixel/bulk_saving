import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
    if (createdServiceIds.length > 0) {
      await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } });
    }
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
  });

  const uniqueSlug = (): string => `svc-${randomInviteCode().toLowerCase()}`;

  it('creates a master service (SUPER_ADMIN)', async () => {
    const slug = uniqueSlug();
    const res = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Deep Cleaning', slug, description: 'Full home deep clean', category: 'Home' })
      .expect(201);
    const svc = res.body.data as AdminServiceDto;
    createdServiceIds.push(svc.id);
    expect(svc).toMatchObject({ name: 'Deep Cleaning', slug, category: 'Home', active: true, imageUrl: null });
  });

  it('rejects a duplicate slug with 409 SERVICE_SLUG_TAKEN', async () => {
    const slug = uniqueSlug();
    const first = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'First', slug, description: 'x', category: 'Home' })
      .expect(201);
    createdServiceIds.push((first.body.data as AdminServiceDto).id);

    const dup = await request(app.getHttpServer())
      .post('/admin/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Second', slug, description: 'y', category: 'Home' })
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
      .send({ name: 'Toggle Me', slug, description: 'x', category: 'Home' })
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
      .send({ name: 'Offerable', slug, description: 'x', category: 'Home' })
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
      .send({ name: 'Nope', slug: uniqueSlug(), description: 'x', category: 'Home' })
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
      .send({ name: 'For Missing Society', slug, description: 'x', category: 'Home' })
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
      .send({ name: '', slug: 'Bad Slug!', description: 'x', category: 'Home' })
      .expect(400);
  });
});
