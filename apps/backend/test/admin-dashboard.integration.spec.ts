import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import request from 'supertest';
import type {
  Resident,
  Round,
  RoundParticipant,
  RoundStatus,
  Service,
  Society,
  Vendor,
} from '@prisma/client';
import type {
  AdminDashboardDto,
  AdminRoundDetailDto,
  AdminRoundParticipantDto,
  AdminRoundSummaryDto,
  AdminSocietyDto,
} from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { ROUND_CLOSING_QUEUE } from '../src/modules/rounds/round-closing.scheduler';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Super-admin dashboard API (FEAT-005 T4–T7, ADR-0012). Against real Postgres:
 *  - `GET /admin/societies`, `GET /admin/rounds` (filters, 400 on a bad status),
 *    `GET /admin/rounds/:id` (participants, 404) and `GET /admin/dashboard` aggregates;
 *  - `POST /admin/rounds/:id/assign`: CLOSED_MET → ASSIGNED with vendor + price +
 *    assignedAt; 409 from OPEN / CLOSED_EXPIRED with NOTHING written; 404 unknown
 *    vendor; 400 VENDOR_INACTIVE; finalPrice bounds;
 *  - `POST /admin/rounds/:id/deliver`: ASSIGNED → DELIVERED; 409 otherwise;
 *  - `PUT .../participants/:participantId/payment`: 409 PAYMENT_NOT_ALLOWED before
 *    assignment, 404 for a participant of another round, idempotent on/off toggle;
 *  - every route group → 403 for a resident token.
 * Other suites share the DB in parallel, so global aggregates are asserted only as
 * lower bounds and per-society demand only for this suite's fixture societies.
 */
describe('Super-admin dashboard API (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queue: Queue;
  let societyA: Society;
  let societyB: Society;
  let admin: Resident;
  let r1: Resident;
  let r2: Resident;
  let r3: Resident;
  let adminToken: string;
  let residentToken: string;
  const services: Service[] = [];
  let activeVendor: Vendor;
  let inactiveVendor: Vendor;
  // Fixture rounds (society A unless noted).
  let open1: Round; // OPEN, 5 units: r1×2, r2×3
  let open2: Round; // OPEN, 4 units: r1×4
  let met: Round; // CLOSED_MET, 5 units: r2×2, r3×3 → assigned, delivered, payments
  let met2: Round; // CLOSED_MET, untouched (deliver → 409)
  let expired: Round; // CLOSED_EXPIRED
  let metParticipants: RoundParticipant[];
  let open1Participants: RoundParticipant[];
  const suffix = randomInviteCode();

  const TIERS = [
    { threshold: 5, price: 900 },
    { threshold: 10, price: 700 },
  ];
  const inAWeek = (): Date => new Date(Date.now() + 7 * 86_400_000);
  // Explicit, strictly increasing createdAt values so "newest first" / "join order"
  // assertions never depend on two inserts landing in different milliseconds.
  let clock = Date.now() - 3_600_000;
  const tick = (): Date => new Date((clock += 1_000));

  const server = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();
  const asAdmin = (req: request.Test): request.Test =>
    req.set('Authorization', `Bearer ${adminToken}`);
  const asResident = (req: request.Test): request.Test =>
    req.set('Authorization', `Bearer ${residentToken}`);

  /** A round on service `serviceIdx`, with participants `[resident, units]` created in order. */
  const createRound = async (
    status: RoundStatus,
    serviceIdx: number,
    pledges: Array<[Resident, number]>,
  ): Promise<{ round: Round; participants: RoundParticipant[] }> => {
    const unitsCount = pledges.reduce((sum, [, units]) => sum + units, 0);
    const round = await prisma.round.create({
      data: {
        societyId: societyA.id,
        serviceId: services[serviceIdx].id,
        status,
        unitsCount,
        deadline: inAWeek(),
        createdAt: tick(),
        tiers: { create: TIERS },
      },
    });
    const participants: RoundParticipant[] = [];
    for (const [resident, units] of pledges) {
      participants.push(
        await prisma.roundParticipant.create({
          data: { roundId: round.id, residentId: resident.id, units, createdAt: tick() },
        }),
      );
    }
    return { round, participants };
  };

  const dbRound = (id: string): Promise<Round> => prisma.round.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    queue = app.get<Queue>(getQueueToken(ROUND_CLOSING_QUEUE));
    const auth = app.get(AuthService);

    // Names sort A before B, and the prefix keeps them adjacent in the name order.
    societyA = await prisma.society.create({
      data: { name: `FEAT5 Dash ${suffix} A`, city: 'Pune', inviteCode: randomInviteCode() },
    });
    societyB = await prisma.society.create({
      data: { name: `FEAT5 Dash ${suffix} B`, city: 'Mumbai', inviteCode: randomInviteCode() },
    });
    const mkResident = (role: 'RESIDENT' | 'SUPER_ADMIN', name: string): Promise<Resident> =>
      prisma.resident.create({
        data: { societyId: societyA.id, phone: randomPhone(), role, name, verifiedAt: new Date() },
      });
    admin = await mkResident('SUPER_ADMIN', 'Admin');
    r1 = await mkResident('RESIDENT', 'Resident One');
    r2 = await mkResident('RESIDENT', 'Resident Two');
    r3 = await mkResident('RESIDENT', 'Resident Three');
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentToken = (await auth.issueTokens(r1)).accessToken;

    for (let i = 0; i < 3; i += 1) {
      services.push(
        await prisma.service.create({
          data: {
            name: `Dash Svc ${i}`,
            slug: `dash-${i}-${suffix.toLowerCase()}`,
            description: 'x',
            category: 'Home Care',
            active: true,
          },
        }),
      );
    }
    activeVendor = await prisma.vendor.create({
      data: { name: `FEAT5 Dash Vendor ${suffix}`, phone: '+919811111111' },
    });
    inactiveVendor = await prisma.vendor.create({
      data: { name: `FEAT5 Dash Idle ${suffix}`, phone: '+919822222222', active: false },
    });

    expired = (await createRound('CLOSED_EXPIRED', 1, [])).round;
    met2 = (await createRound('CLOSED_MET', 2, [[r1, 5]])).round;
    const metFixture = await createRound('CLOSED_MET', 0, [
      [r2, 2],
      [r3, 3],
    ]);
    met = metFixture.round;
    metParticipants = metFixture.participants;
    open2 = (await createRound('OPEN', 1, [[r1, 4]])).round;
    const open1Fixture = await createRound('OPEN', 0, [
      [r1, 2],
      [r2, 3],
    ]);
    open1 = open1Fixture.round;
    open1Participants = open1Fixture.participants;
  });

  afterAll(async () => {
    const rounds = await prisma.round.findMany({
      where: { societyId: { in: [societyA.id, societyB.id] } },
      select: { id: true },
    });
    // Another suite's boot reconciler may have scheduled close jobs for our OPEN rounds.
    await Promise.all(rounds.map(async (r) => (await queue.getJob(r.id))?.remove()));
    await prisma.service.deleteMany({ where: { id: { in: services.map((s) => s.id) } } });
    await prisma.society.deleteMany({ where: { id: { in: [societyA.id, societyB.id] } } });
    // Rounds are gone, so the Restrict FK no longer blocks the vendors.
    await prisma.vendor.deleteMany({ where: { id: { in: [activeVendor.id, inactiveVendor.id] } } });
    await app.close();
  });

  describe('GET /admin/societies', () => {
    it('lists every society (id, name, city, inviteCode) ordered by name', async () => {
      const res = await asAdmin(request(server()).get('/admin/societies')).expect(200);
      const list = res.body.data as AdminSocietyDto[];
      const idxA = list.findIndex((s) => s.id === societyA.id);
      const idxB = list.findIndex((s) => s.id === societyB.id);
      expect(idxA).toBeGreaterThanOrEqual(0);
      expect(idxB).toBe(idxA + 1);
      expect(list[idxA]).toEqual({
        id: societyA.id,
        name: societyA.name,
        city: 'Pune',
        inviteCode: societyA.inviteCode,
      });
    });
  });

  describe('GET /admin/rounds', () => {
    it('lists a society’s rounds newest first as summaries', async () => {
      const res = await asAdmin(
        request(server()).get('/admin/rounds').query({ societyId: societyA.id }),
      ).expect(200);
      const list = res.body.data.items as AdminRoundSummaryDto[];
      expect(list.map((r) => r.id)).toEqual([open1.id, open2.id, met.id, met2.id, expired.id]);

      const summary = list[0];
      expect(summary).toMatchObject({
        id: open1.id,
        status: 'OPEN',
        society: { id: societyA.id, name: societyA.name, city: 'Pune' },
        service: { id: services[0].id },
        unitsCount: 5,
        participantsCount: 2,
        currentPrice: 900,
        nextTier: { threshold: 10, price: 700 },
        tiers: TIERS,
        vendor: null,
        finalPrice: null,
        assignedAt: null,
        deliveredAt: null,
        payments: {
          participantsCount: 2,
          collectedCount: 0,
          collectedAmount: 0,
          outstandingAmount: 0,
        },
      });
      expect(summary.deadline).toBe(open1.deadline.toISOString());
      expect(summary.createdAt).toBe(open1.createdAt.toISOString());
    });

    it('filters by status + society', async () => {
      const res = await asAdmin(
        request(server()).get('/admin/rounds').query({ status: 'OPEN', societyId: societyA.id }),
      ).expect(200);
      expect((res.body.data.items as AdminRoundSummaryDto[]).map((r) => r.id)).toEqual([
        open1.id,
        open2.id,
      ]);

      const empty = await asAdmin(
        request(server()).get('/admin/rounds').query({ societyId: societyB.id }),
      ).expect(200);
      expect(empty.body.data.items).toEqual([]);
    });

    it('filters by status alone across societies', async () => {
      const res = await asAdmin(
        request(server()).get('/admin/rounds').query({ status: 'CLOSED_EXPIRED' }),
      ).expect(200);
      const list = res.body.data.items as AdminRoundSummaryDto[];
      expect(list.length).toBeLessThanOrEqual(200);
      expect(list.every((r) => r.status === 'CLOSED_EXPIRED')).toBe(true);
    });

    it('rejects an invalid status with 400', async () => {
      await asAdmin(request(server()).get('/admin/rounds').query({ status: 'BOGUS' })).expect(400);
    });
  });

  describe('GET /admin/rounds/:id', () => {
    it('returns the detail with participants (resident name + phone) in join order', async () => {
      const res = await asAdmin(request(server()).get(`/admin/rounds/${open1.id}`)).expect(200);
      const detail = res.body.data as AdminRoundDetailDto;
      expect(detail.id).toBe(open1.id);
      expect(detail.participantsCount).toBe(2);
      expect(detail.participants).toEqual([
        {
          id: open1Participants[0].id,
          resident: { id: r1.id, name: 'Resident One', phone: r1.phone },
          units: 2,
          amountDue: null,
          paymentCollected: false,
          paymentCollectedAt: null,
          joinedAt: open1Participants[0].createdAt.toISOString(),
          rating: null, // FEAT-007: nobody has rated an OPEN round
        },
        {
          id: open1Participants[1].id,
          resident: { id: r2.id, name: 'Resident Two', phone: r2.phone },
          units: 3,
          amountDue: null,
          paymentCollected: false,
          paymentCollectedAt: null,
          joinedAt: open1Participants[1].createdAt.toISOString(),
          rating: null,
        },
      ]);
    });

    it('returns 404 NOT_FOUND for an unknown round', async () => {
      const res = await asAdmin(request(server()).get('/admin/rounds/does-not-exist')).expect(404);
      expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
    });
  });

  describe('payment before assignment', () => {
    it('PUT payment on a CLOSED_MET round → 409 PAYMENT_NOT_ALLOWED, nothing written', async () => {
      const res = await asAdmin(
        request(server())
          .put(`/admin/rounds/${met.id}/participants/${metParticipants[0].id}/payment`)
          .send({ collected: true }),
      ).expect(409);
      expect(res.body.error.code).toBe(ErrorCode.PAYMENT_NOT_ALLOWED);
      const row = await prisma.roundParticipant.findUniqueOrThrow({
        where: { id: metParticipants[0].id },
      });
      expect(row.paymentCollectedAt).toBeNull();
    });
  });

  describe('POST /admin/rounds/:id/assign', () => {
    const assign = (roundId: string, body: Record<string, unknown>): request.Test =>
      asAdmin(request(server()).post(`/admin/rounds/${roundId}/assign`).send(body));

    it.each<[string, () => Round, RoundStatus]>([
      ['OPEN', () => open2, 'OPEN'],
      ['CLOSED_EXPIRED', () => expired, 'CLOSED_EXPIRED'],
    ])('from %s → 409 INVALID_ROUND_TRANSITION with nothing written', async (_l, pick, status) => {
      const round = pick();
      const res = await assign(round.id, { vendorId: activeVendor.id, finalPrice: 600 }).expect(
        409,
      );
      expect(res.body.error.code).toBe(ErrorCode.INVALID_ROUND_TRANSITION);
      const row = await dbRound(round.id);
      expect(row).toMatchObject({ status, vendorId: null, finalPrice: null, assignedAt: null });
    });

    it('checks transition legality before the vendor: OPEN + unknown vendor → 409', async () => {
      const res = await assign(open2.id, { vendorId: 'no-such-vendor', finalPrice: 600 }).expect(
        409,
      );
      expect(res.body.error.code).toBe(ErrorCode.INVALID_ROUND_TRANSITION);
    });

    it('unknown vendor → 404 NOT_FOUND; inactive vendor → 400 VENDOR_INACTIVE; nothing written', async () => {
      const unknown = await assign(met.id, { vendorId: 'no-such-vendor', finalPrice: 600 }).expect(
        404,
      );
      expect(unknown.body.error.code).toBe(ErrorCode.NOT_FOUND);

      const inactive = await assign(met.id, {
        vendorId: inactiveVendor.id,
        finalPrice: 600,
      }).expect(400);
      expect(inactive.body.error.code).toBe(ErrorCode.VENDOR_INACTIVE);

      expect(await dbRound(met.id)).toMatchObject({
        status: 'CLOSED_MET',
        vendorId: null,
        finalPrice: null,
        assignedAt: null,
      });
    });

    it.each<[string, Record<string, unknown>]>([
      ['finalPrice 0', { finalPrice: 0 }],
      ['finalPrice above 1,000,000', { finalPrice: 1_000_001 }],
      ['non-integer finalPrice', { finalPrice: 12.5 }],
      ['missing vendorId', { vendorId: undefined, finalPrice: 600 }],
    ])('rejects %s with 400', async (_label, override) => {
      await assign(met.id, { vendorId: activeVendor.id, finalPrice: 600, ...override }).expect(400);
    });

    it('returns 404 for an unknown round', async () => {
      await assign('does-not-exist', { vendorId: activeVendor.id, finalPrice: 600 }).expect(404);
    });

    it('CLOSED_MET → ASSIGNED, storing vendor + finalPrice + assignedAt (201, detail)', async () => {
      const before = Date.now();
      const res = await assign(met.id, { vendorId: activeVendor.id, finalPrice: 600 }).expect(201);
      const detail = res.body.data as AdminRoundDetailDto;
      expect(detail).toMatchObject({
        id: met.id,
        status: 'ASSIGNED',
        vendor: { id: activeVendor.id, name: activeVendor.name, phone: activeVendor.phone },
        finalPrice: 600,
        deliveredAt: null,
        payments: {
          participantsCount: 2,
          collectedCount: 0,
          collectedAmount: 0,
          outstandingAmount: 3000,
        },
      });
      expect(new Date(detail.assignedAt ?? 0).getTime()).toBeGreaterThanOrEqual(before - 1_000);
      expect(detail.participants.map((p) => p.amountDue)).toEqual([1200, 1800]);

      const row = await dbRound(met.id);
      expect(row).toMatchObject({ status: 'ASSIGNED', vendorId: activeVendor.id, finalPrice: 600 });
      expect(row.assignedAt).not.toBeNull();
    });

    it('assigning again → 409 and keeps the original assignment', async () => {
      const original = await dbRound(met.id);
      await assign(met.id, { vendorId: activeVendor.id, finalPrice: 999 }).expect(409);
      const row = await dbRound(met.id);
      expect(row.finalPrice).toBe(600);
      expect(row.assignedAt).toEqual(original.assignedAt);
    });
  });

  describe('PUT /admin/rounds/:roundId/participants/:participantId/payment', () => {
    const setPayment = (roundId: string, participantId: string, body: unknown): request.Test =>
      asAdmin(
        request(server())
          .put(`/admin/rounds/${roundId}/participants/${participantId}/payment`)
          .send(body as object),
      );

    it('a participant of a different round → 404; unknown round → 404', async () => {
      const wrong = await setPayment(met.id, open1Participants[0].id, { collected: true }).expect(
        404,
      );
      expect(wrong.body.error.code).toBe(ErrorCode.NOT_FOUND);
      await setPayment('does-not-exist', metParticipants[0].id, { collected: true }).expect(404);
    });

    it('rejects a non-boolean body with 400', async () => {
      await setPayment(met.id, metParticipants[0].id, { collected: 'yes' }).expect(400);
    });

    it('marks collected (200), idempotently keeping the first timestamp, and totals follow', async () => {
      const first = await setPayment(met.id, metParticipants[0].id, { collected: true }).expect(
        200,
      );
      const p1 = first.body.data as AdminRoundParticipantDto;
      expect(p1).toMatchObject({
        id: metParticipants[0].id,
        resident: { id: r2.id, phone: r2.phone },
        units: 2,
        amountDue: 1200,
        paymentCollected: true,
      });
      expect(p1.paymentCollectedAt).not.toBeNull();

      const again = await setPayment(met.id, metParticipants[0].id, { collected: true }).expect(
        200,
      );
      expect((again.body.data as AdminRoundParticipantDto).paymentCollectedAt).toBe(
        p1.paymentCollectedAt,
      );

      const detail = await asAdmin(request(server()).get(`/admin/rounds/${met.id}`)).expect(200);
      expect((detail.body.data as AdminRoundDetailDto).payments).toEqual({
        participantsCount: 2,
        collectedCount: 1,
        collectedAmount: 1200,
        outstandingAmount: 1800,
      });
    });

    it('clears the flag with collected: false', async () => {
      await setPayment(met.id, metParticipants[1].id, { collected: true }).expect(200);
      const res = await setPayment(met.id, metParticipants[1].id, { collected: false }).expect(200);
      expect(res.body.data).toMatchObject({ paymentCollected: false, paymentCollectedAt: null });
      const row = await prisma.roundParticipant.findUniqueOrThrow({
        where: { id: metParticipants[1].id },
      });
      expect(row.paymentCollectedAt).toBeNull();
    });
  });

  describe('POST /admin/rounds/:id/deliver', () => {
    it('from CLOSED_MET → 409 INVALID_ROUND_TRANSITION, nothing written', async () => {
      const res = await asAdmin(request(server()).post(`/admin/rounds/${met2.id}/deliver`)).expect(
        409,
      );
      expect(res.body.error.code).toBe(ErrorCode.INVALID_ROUND_TRANSITION);
      expect(await dbRound(met2.id)).toMatchObject({ status: 'CLOSED_MET', deliveredAt: null });
    });

    it('returns 404 for an unknown round', async () => {
      await asAdmin(request(server()).post('/admin/rounds/does-not-exist/deliver')).expect(404);
    });

    it('ASSIGNED → DELIVERED with deliveredAt (201, detail); again → 409', async () => {
      const res = await asAdmin(request(server()).post(`/admin/rounds/${met.id}/deliver`)).expect(
        201,
      );
      const detail = res.body.data as AdminRoundDetailDto;
      expect(detail.status).toBe('DELIVERED');
      expect(detail.deliveredAt).not.toBeNull();
      expect(detail.finalPrice).toBe(600);

      await asAdmin(request(server()).post(`/admin/rounds/${met.id}/deliver`)).expect(409);
    });

    it('payments can still be toggled on a DELIVERED round', async () => {
      await asAdmin(
        request(server())
          .put(`/admin/rounds/${met.id}/participants/${metParticipants[1].id}/payment`)
          .send({ collected: true }),
      ).expect(200);
      await asAdmin(
        request(server())
          .put(`/admin/rounds/${met.id}/participants/${metParticipants[1].id}/payment`)
          .send({ collected: false }),
      ).expect(200);
    });
  });

  describe('GET /admin/dashboard', () => {
    it('returns status counts (all 7), demand per fixture society and payment totals', async () => {
      const res = await asAdmin(request(server()).get('/admin/dashboard')).expect(200);
      const dash = res.body.data as AdminDashboardDto;

      // Global counts: every status present; at least this suite's fixtures.
      const expectedMin: Record<RoundStatus, number> = {
        OPEN: 2,
        CLOSED_MET: 1,
        CLOSED_EXPIRED: 1,
        ASSIGNED: 0,
        DELIVERED: 1,
        RATED: 0,
        CANCELLED: 0,
      };
      expect(Object.keys(dash.statusCounts).sort()).toEqual(Object.keys(expectedMin).sort());
      for (const [status, min] of Object.entries(expectedMin)) {
        expect(dash.statusCounts[status as RoundStatus]).toBeGreaterThanOrEqual(min);
      }

      // Demand: exact for this suite's societies, which are adjacent in name order.
      const idxA = dash.demandBySociety.findIndex((d) => d.society.id === societyA.id);
      expect(idxA).toBeGreaterThanOrEqual(0);
      expect(dash.demandBySociety[idxA]).toEqual({
        society: { id: societyA.id, name: societyA.name, city: 'Pune' },
        openRounds: 2,
        unitsPledged: 9,
        residentsJoined: 2, // r1 (in both OPEN rounds) + r2
      });
      expect(dash.demandBySociety[idxA + 1]).toEqual({
        society: { id: societyB.id, name: societyB.name, city: 'Mumbai' },
        openRounds: 0,
        unitsPledged: 0,
        residentsJoined: 0,
      });

      // Payments: the DELIVERED fixture contributes 1200 collected + 1800 outstanding.
      expect(dash.payments.collectedAmount).toBeGreaterThanOrEqual(1200);
      expect(dash.payments.outstandingAmount).toBeGreaterThanOrEqual(1800);
    });
  });

  describe('authorization', () => {
    it('DENIES every new admin route group to a RESIDENT token with 403', async () => {
      await asResident(request(server()).get('/admin/societies')).expect(403);
      await asResident(request(server()).get('/admin/dashboard')).expect(403);
      await asResident(request(server()).get('/admin/rounds')).expect(403);
      await asResident(request(server()).get(`/admin/rounds/${met.id}`)).expect(403);
      await asResident(
        request(server())
          .post(`/admin/rounds/${met2.id}/assign`)
          .send({ vendorId: activeVendor.id, finalPrice: 600 }),
      ).expect(403);
      await asResident(request(server()).post(`/admin/rounds/${met.id}/deliver`)).expect(403);
      await asResident(
        request(server())
          .put(`/admin/rounds/${met.id}/participants/${metParticipants[0].id}/payment`)
          .send({ collected: false }),
      ).expect(403);
      // The 403s wrote nothing.
      expect(await dbRound(met2.id)).toMatchObject({ status: 'CLOSED_MET', vendorId: null });
    });
  });
});
