import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type { Resident, Service, Society } from '@prisma/client';
import type { RoundDto } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { ROUND_CLOSING_QUEUE } from '../src/modules/rounds/round-closing.scheduler';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Admin round API (FEAT-003 T3). `POST /admin/rounds` opens a round for a
 * (society, service) with tiers; `POST /admin/rounds/:id/close` closes it (FEAT-004: CLOSED_MET / CLOSED_EXPIRED by
 * units) and `POST /admin/rounds/:id/cancel` cancels it; open schedules a deadline
 * job, close/cancel removes it. All SUPER_ADMIN-only (a resident token → 403). A second OPEN round for the same
 * pair → 409 ROUND_ALREADY_OPEN (proving the partial unique index + guard, not a
 * 500). Needs DB + Redis.
 */
describe('Admin rounds API (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let society: Society;
  let admin: Resident;
  let resident: Resident;
  let adminToken: string;
  let residentToken: string;
  let acService: Service; // offered + enabled
  let disabledService: Service; // offering disabled
  let queue: Queue;
  const slugSuffix = randomInviteCode().toLowerCase();

  const futureIso = (days = 7): string => new Date(Date.now() + days * 86_400_000).toISOString();

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    queue = app.get<Queue>(getQueueToken(ROUND_CLOSING_QUEUE));

    society = await prisma.society.create({
      data: { name: 'Rounds Admin Society', city: 'Pune', inviteCode: randomInviteCode() },
    });
    admin = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() },
    });
    resident = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() },
    });
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentToken = (await auth.issueTokens(resident)).accessToken;

    acService = await prisma.service.create({
      data: { name: 'AC Servicing', slug: `ac-${slugSuffix}`, description: 'x', category: 'Appliances', active: true },
    });
    disabledService = await prisma.service.create({
      data: { name: 'Disabled Svc', slug: `dis-${slugSuffix}`, description: 'x', category: 'Home', active: true },
    });
    await prisma.serviceOffering.createMany({
      data: [
        { societyId: society.id, serviceId: acService.id, enabled: true, indicativePrice: 499 },
        { societyId: society.id, serviceId: disabledService.id, enabled: false },
      ],
    });
  });

  afterAll(async () => {
    // Drop any still-pending deadline jobs for this suite's rounds (days out).
    const rounds = await prisma.round.findMany({ where: { societyId: society.id }, select: { id: true } });
    await Promise.all(rounds.map(async (r) => (await queue.getJob(r.id))?.remove()));
    await prisma.service.deleteMany({ where: { id: { in: [acService.id, disabledService.id] } } });
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
  });

  const openBody = (): Record<string, unknown> => ({
    societyId: society.id,
    serviceId: acService.id,
    deadline: futureIso(),
    tiers: [
      { threshold: 5, price: 900 },
      { threshold: 10, price: 700 },
    ],
  });

  it('opens a round (SUPER_ADMIN) with sorted tiers and starting price', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(openBody())
      .expect(201);
    const round = res.body.data as RoundDto;
    expect(round.status).toBe('OPEN');
    expect(round.unitsCount).toBe(0);
    expect(round.service.id).toBe(acService.id);
    expect(round.tiers).toEqual([
      { threshold: 5, price: 900 },
      { threshold: 10, price: 700 },
    ]);
    expect(round.currentPrice).toBe(900);
    expect(round.nextTier).toEqual({ threshold: 5, price: 900 });
    expect(round.myUnits).toBe(0);
  });

  it('rejects a SECOND open round for the same (society, service) with 409 ROUND_ALREADY_OPEN', async () => {
    const dup = await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(openBody())
      .expect(409);
    expect(dup.body.error.code).toBe(ErrorCode.ROUND_ALREADY_OPEN);
  });

  it('rejects opening a round for a service not offered/enabled (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...openBody(), serviceId: disabledService.id })
      .expect(400);
    expect(res.body.error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('rejects non-ascending tier thresholds (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...openBody(),
        serviceId: disabledService.id, // avoid the already-open guard tripping first
        tiers: [
          { threshold: 10, price: 700 },
          { threshold: 5, price: 900 },
        ],
      })
      .expect(400);
    expect(res.body.error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('rejects a past deadline (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...openBody(), serviceId: disabledService.id, deadline: futureIso(-1) })
      .expect(400);
    expect(res.body.error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it('rejects an empty tier list via DTO validation (400)', async () => {
    await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...openBody(), serviceId: disabledService.id, tiers: [] })
      .expect(400);
  });

  it('DENIES POST /admin/rounds to a RESIDENT token with 403', async () => {
    await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${residentToken}`)
      .send(openBody())
      .expect(403);
  });

  it('opening a round enqueues a delayed close job (jobId = round id, fires at deadline)', async () => {
    const open = await prisma.round.findFirstOrThrow({
      where: { societyId: society.id, serviceId: acService.id, status: 'OPEN' },
    });
    const job = await queue.getJob(open.id);
    expect(job).toBeDefined();
    expect(job?.data).toEqual({ roundId: open.id });
    expect(await job?.getState()).toBe('delayed');
    // Scheduled delay targets the deadline (allow slack for test execution time).
    const firesAt = (job?.timestamp ?? 0) + (job?.opts.delay ?? 0);
    expect(Math.abs(firesAt - open.deadline.getTime())).toBeLessThan(5_000);
  });

  it('closes a round below the lowest threshold → CLOSED_EXPIRED, removes its job, reopening becomes possible', async () => {
    const open = await prisma.round.findFirstOrThrow({
      where: { societyId: society.id, serviceId: acService.id, status: 'OPEN' },
    });
    const res = await request(app.getHttpServer())
      .post(`/admin/rounds/${open.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((res.body.data as RoundDto).status).toBe('CLOSED_EXPIRED');
    expect(await queue.getJob(open.id)).toBeUndefined();

    // With no OPEN round left, the partial unique index permits a fresh open.
    await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(openBody())
      .expect(201);
  });

  it('DENIES close to a RESIDENT token with 403', async () => {
    const open = await prisma.round.findFirstOrThrow({
      where: { societyId: society.id, serviceId: acService.id, status: 'OPEN' },
    });
    await request(app.getHttpServer())
      .post(`/admin/rounds/${open.id}/close`)
      .set('Authorization', `Bearer ${residentToken}`)
      .expect(403);
  });

  it('closes a round at/above the lowest threshold → CLOSED_MET', async () => {
    const open = await prisma.round.findFirstOrThrow({
      where: { societyId: society.id, serviceId: acService.id, status: 'OPEN' },
    });
    // Seed the authoritative count directly (join path is covered elsewhere); lowest threshold = 5.
    await prisma.round.update({ where: { id: open.id }, data: { unitsCount: 5 } });
    const res = await request(app.getHttpServer())
      .post(`/admin/rounds/${open.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((res.body.data as RoundDto).status).toBe('CLOSED_MET');
  });

  it('closing an already-closed round is an idempotent no-op (keeps its status)', async () => {
    const met = await prisma.round.findFirstOrThrow({
      where: { societyId: society.id, serviceId: acService.id, status: 'CLOSED_MET' },
    });
    const res = await request(app.getHttpServer())
      .post(`/admin/rounds/${met.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((res.body.data as RoundDto).status).toBe('CLOSED_MET');
  });

  it('cancels an OPEN round (SUPER_ADMIN) → CANCELLED and removes its job', async () => {
    const opened = await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(openBody())
      .expect(201);
    const id = (opened.body.data as RoundDto).id;
    expect(await queue.getJob(id)).toBeDefined();

    const res = await request(app.getHttpServer())
      .post(`/admin/rounds/${id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((res.body.data as RoundDto).status).toBe('CANCELLED');
    expect(await queue.getJob(id)).toBeUndefined();
  });

  it('cancels a CLOSED_MET round; cancelling again → 409 INVALID_ROUND_TRANSITION', async () => {
    const met = await prisma.round.findFirstOrThrow({
      where: { societyId: society.id, serviceId: acService.id, status: 'CLOSED_MET' },
    });
    const ok = await request(app.getHttpServer())
      .post(`/admin/rounds/${met.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect((ok.body.data as RoundDto).status).toBe('CANCELLED');

    const again = await request(app.getHttpServer())
      .post(`/admin/rounds/${met.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(again.body.error.code).toBe(ErrorCode.INVALID_ROUND_TRANSITION);
  });

  it('DENIES cancel to a RESIDENT token with 403; unknown round → 404', async () => {
    const opened = await request(app.getHttpServer())
      .post('/admin/rounds')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(openBody())
      .expect(201);
    await request(app.getHttpServer())
      .post(`/admin/rounds/${(opened.body.data as RoundDto).id}/cancel`)
      .set('Authorization', `Bearer ${residentToken}`)
      .expect(403);
    const missing = await request(app.getHttpServer())
      .post('/admin/rounds/does-not-exist/cancel')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(missing.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('returns 404 closing an unknown round (SUPER_ADMIN)', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/rounds/does-not-exist/close')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });
});
