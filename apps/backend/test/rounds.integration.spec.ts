import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Round, Service, Society } from '@prisma/client';
import type { RoundDto } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Resident rounds API (FEAT-003 T4/T5/T6). Covers the tenant-scoped list with
 * pricing + myUnits, the atomic join/update/leave path, and — the highest-risk
 * assertion — a concurrent-join test proving the authoritative unitsCount equals
 * the exact sum of pledged units (no lost updates / oversell). Needs DB + Redis.
 */
describe('Resident rounds API (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let societyA: Society;
  let societyB: Society;
  let service: Service;
  let serviceClosed: Service;
  let serviceConc: Service;
  let serviceSameRes: Service;
  let serviceSameRes2: Service;
  let serviceB: Service;
  let roundA: Round; // OPEN in A, tiers 5->900 / 10->700
  let roundClosed: Round; // CLOSED_EXPIRED in A (join-rejection target)
  let roundB: Round; // OPEN in B (tenant-isolation target)
  let resident: Resident;
  let token: string;

  const TIERS = [
    { threshold: 5, price: 900 },
    { threshold: 10, price: 700 },
  ];
  const future = (): Date => new Date(Date.now() + 7 * 86_400_000);

  const createRound = (
    societyId: string,
    serviceId: string,
    status: 'OPEN' | 'CLOSED_EXPIRED',
  ): Promise<Round> =>
    prisma.round.create({
      data: {
        societyId,
        serviceId,
        status,
        deadline: future(),
        tiers: { create: TIERS },
      },
    });

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    const s = randomInviteCode().toLowerCase();
    societyA = await prisma.society.create({
      data: { name: 'Rounds A', city: 'Pune', inviteCode: randomInviteCode() },
    });
    societyB = await prisma.society.create({
      data: { name: 'Rounds B', city: 'Mumbai', inviteCode: randomInviteCode() },
    });
    resident = await prisma.resident.create({
      data: { societyId: societyA.id, phone: randomPhone(), verifiedAt: new Date() },
    });
    token = (await auth.issueTokens(resident)).accessToken;

    service = await prisma.service.create({
      data: { name: 'AC Servicing', slug: `ac-${s}`, description: 'x', category: 'Appliances', active: true },
    });
    serviceClosed = await prisma.service.create({
      data: { name: 'Closed Svc', slug: `cl-${s}`, description: 'x', category: 'Home Care', active: true },
    });
    serviceConc = await prisma.service.create({
      data: { name: 'Concurrency Svc', slug: `co-${s}`, description: 'x', category: 'Home Care', active: true },
    });
    serviceSameRes = await prisma.service.create({
      data: { name: 'Same-Resident Svc', slug: `sr-${s}`, description: 'x', category: 'Home Care', active: true },
    });
    serviceSameRes2 = await prisma.service.create({
      data: { name: 'Same-Resident Svc 2', slug: `sr2-${s}`, description: 'x', category: 'Home Care', active: true },
    });
    serviceB = await prisma.service.create({
      data: { name: 'B Svc', slug: `b-${s}`, description: 'x', category: 'Home Care', active: true },
    });

    roundA = await createRound(societyA.id, service.id, 'OPEN');
    roundClosed = await createRound(societyA.id, serviceClosed.id, 'CLOSED_EXPIRED');
    roundB = await createRound(societyB.id, serviceB.id, 'OPEN');
  });

  afterAll(async () => {
    await prisma.service.deleteMany({
      where: {
        id: {
          in: [service.id, serviceClosed.id, serviceConc.id, serviceSameRes.id, serviceSameRes2.id, serviceB.id],
        },
      },
    });
    await prisma.society.deleteMany({ where: { id: { in: [societyA.id, societyB.id] } } });
    await app.close();
  });

  const authGet = (): request.Test =>
    request(app.getHttpServer()).get('/rounds').set('Authorization', `Bearer ${token}`);

  it('lists OPEN rounds for the caller society with pricing + myUnits; hides other societies', async () => {
    const res = await authGet().expect(200);
    const rounds = res.body.data.items as RoundDto[];
    const ids = rounds.map((r) => r.id);
    expect(ids).toContain(roundA.id);
    expect(ids).not.toContain(roundClosed.id); // not OPEN
    expect(ids).not.toContain(roundB.id); // TENANT ISOLATION: other society

    const a = rounds.find((r) => r.id === roundA.id) as RoundDto;
    expect(a.currentPrice).toBe(900);
    expect(a.nextTier).toEqual({ threshold: 5, price: 900 });
    expect(a.myUnits).toBe(0);
    expect(a.service.slug).toBe(service.slug);
  });

  it('rejects an unauthenticated list request with 401', async () => {
    await request(app.getHttpServer()).get('/rounds').expect(401);
  });

  it('first join sets unitsCount + myUnits (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rounds/${roundA.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ units: 3 })
      .expect(201);
    const round = res.body.data as RoundDto;
    expect(round.unitsCount).toBe(3);
    expect(round.myUnits).toBe(3);
    expect(round.currentPrice).toBe(900); // below first threshold
    expect(round.nextTier).toEqual({ threshold: 5, price: 900 });
  });

  it('re-joining the SAME resident UPDATES the pledge (no duplicate row)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rounds/${roundA.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ units: 6 })
      .expect(201);
    const round = res.body.data as RoundDto;
    expect(round.unitsCount).toBe(6); // replaced 3, NOT 3 + 6
    expect(round.myUnits).toBe(6);
    expect(round.currentPrice).toBe(900); // >=5, <10
    expect(round.nextTier).toEqual({ threshold: 10, price: 700 });

    const count = await prisma.roundParticipant.count({
      where: { roundId: roundA.id, residentId: resident.id },
    });
    expect(count).toBe(1);
  });

  it('PATCH changes the pledge and applies the delta', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rounds/${roundA.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ units: 12 })
      .expect(200);
    const round = res.body.data as RoundDto;
    expect(round.unitsCount).toBe(12);
    expect(round.myUnits).toBe(12);
    expect(round.currentPrice).toBe(700); // top tier reached
    expect(round.nextTier).toBeUndefined();
  });

  it('DELETE leaves the round and decrements the count', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/rounds/${roundA.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const round = res.body.data as RoundDto;
    expect(round.unitsCount).toBe(0);
    expect(round.myUnits).toBe(0);

    const count = await prisma.roundParticipant.count({ where: { roundId: roundA.id } });
    expect(count).toBe(0);
  });

  it('PATCH / DELETE when not joined → 404 NOT_FOUND', async () => {
    const patch = await request(app.getHttpServer())
      .patch(`/rounds/${roundA.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ units: 2 })
      .expect(404);
    expect(patch.body.error.code).toBe(ErrorCode.NOT_FOUND);

    const del = await request(app.getHttpServer())
      .delete(`/rounds/${roundA.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(del.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('joining a CLOSED round → 409 ROUND_CLOSED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rounds/${roundClosed.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ units: 2 })
      .expect(409);
    expect(res.body.error.code).toBe(ErrorCode.ROUND_CLOSED);
  });

  it('joining a round in ANOTHER society → 404 (tenant isolation)', async () => {
    const exists = await prisma.round.findUnique({ where: { id: roundB.id } });
    expect(exists).not.toBeNull();
    const res = await request(app.getHttpServer())
      .post(`/rounds/${roundB.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ units: 2 })
      .expect(404);
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('rejects units < 1 and units > 50 via DTO validation (400)', async () => {
    await request(app.getHttpServer())
      .post(`/rounds/${roundA.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ units: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/rounds/${roundA.id}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ units: 51 })
      .expect(400);
  });

  it('CONCURRENCY: N concurrent joins → unitsCount == exact sum of pledged units', async () => {
    const N = 20;
    const roundC = await createRound(societyA.id, serviceConc.id, 'OPEN');

    // Distinct residents in society A, each with their own token + pledge.
    const joiners = await Promise.all(
      Array.from({ length: N }, async (_unused, i) => {
        const r = await prisma.resident.create({
          data: { societyId: societyA.id, phone: randomPhone(), verifiedAt: new Date() },
        });
        const t = (await auth.issueTokens(r)).accessToken;
        return { token: t, units: i + 1 }; // 1..20
      }),
    );
    const expectedSum = joiners.reduce((acc, j) => acc + j.units, 0); // 210

    // Bind the HTTP server ONCE up front so the parallel burst reuses a single
    // listening socket. Otherwise supertest lazily calls listen(0) per request
    // and N simultaneous binds race (ECONNRESET) — a harness artefact, not a
    // domain concurrency issue. This keeps the test deterministic.
    const server = app.getHttpServer();
    if (server.address() === null) {
      await new Promise<void>((resolve) => server.listen(0, resolve));
    }

    // Fire all joins simultaneously against the already-listening server.
    const results = await Promise.all(
      joiners.map((j) =>
        request(server)
          .post(`/rounds/${roundC.id}/join`)
          .set('Authorization', `Bearer ${j.token}`)
          .send({ units: j.units }),
      ),
    );
    results.forEach((res) => expect(res.status).toBe(201));

    // Authoritative count in Postgres must equal the exact sum — no lost updates.
    const finalRound = await prisma.round.findUniqueOrThrow({ where: { id: roundC.id } });
    expect(finalRound.unitsCount).toBe(expectedSum);

    const participantCount = await prisma.roundParticipant.count({ where: { roundId: roundC.id } });
    expect(participantCount).toBe(N);
  });

  it('CONCURRENCY (same resident): parallel join+PATCH never drift unitsCount from the pledge', async () => {
    // The V2 gap: two concurrent mutations from the SAME resident used to both
    // read a stale participant row and both apply their delta, leaving
    // unitsCount != participant.units. With the FOR UPDATE row lock, all
    // mutations on the round serialize, so the invariant must always hold:
    // unitsCount === the single participant's units, whatever order they land.
    const roundD = await createRound(societyA.id, serviceSameRes.id, 'OPEN');
    const solo = await prisma.resident.create({
      data: { societyId: societyA.id, phone: randomPhone(), verifiedAt: new Date() },
    });
    const soloToken = (await auth.issueTokens(solo)).accessToken;

    // Bind the server once so the parallel burst reuses one listening socket.
    const server = app.getHttpServer();
    if (server.address() === null) {
      await new Promise<void>((resolve) => server.listen(0, resolve));
    }

    // Seed the participant so every racing PATCH has an existing row to update.
    await request(server)
      .post(`/rounds/${roundD.id}/join`)
      .set('Authorization', `Bearer ${soloToken}`)
      .send({ units: 5 })
      .expect(201);

    // Fire a burst of POST joins and PATCH updates from the SAME resident at once.
    const ops = [3, 7, 2, 9, 4, 6].map((units, i) =>
      i % 2 === 0
        ? request(server)
            .post(`/rounds/${roundD.id}/join`)
            .set('Authorization', `Bearer ${soloToken}`)
            .send({ units })
        : request(server)
            .patch(`/rounds/${roundD.id}/join`)
            .set('Authorization', `Bearer ${soloToken}`)
            .send({ units }),
    );
    const results = await Promise.all(ops);
    results.forEach((res) => expect([200, 201]).toContain(res.status));

    // Exactly one participant row, and unitsCount equals its pledge — no drift.
    const participants = await prisma.roundParticipant.findMany({ where: { roundId: roundD.id } });
    expect(participants).toHaveLength(1);
    const finalRound = await prisma.round.findUniqueOrThrow({ where: { id: roundD.id } });
    expect(finalRound.unitsCount).toBe(participants[0].units);
  });

  it('CONCURRENCY (same resident): parallel PATCH then leave ends consistent (count 0)', async () => {
    const roundE = await createRound(societyA.id, serviceSameRes2.id, 'OPEN');
    const solo = await prisma.resident.create({
      data: { societyId: societyA.id, phone: randomPhone(), verifiedAt: new Date() },
    });
    const soloToken = (await auth.issueTokens(solo)).accessToken;

    const server = app.getHttpServer();
    if (server.address() === null) {
      await new Promise<void>((resolve) => server.listen(0, resolve));
    }

    await request(server)
      .post(`/rounds/${roundE.id}/join`)
      .set('Authorization', `Bearer ${soloToken}`)
      .send({ units: 8 })
      .expect(201);

    // Concurrent PATCHes race; each either updates or (post-leave) 404s — but the
    // final state is always consistent: unitsCount == sum(participant.units).
    await Promise.all([
      request(server)
        .patch(`/rounds/${roundE.id}/join`)
        .set('Authorization', `Bearer ${soloToken}`)
        .send({ units: 4 }),
      request(server)
        .patch(`/rounds/${roundE.id}/join`)
        .set('Authorization', `Bearer ${soloToken}`)
        .send({ units: 10 }),
      request(server).delete(`/rounds/${roundE.id}/join`).set('Authorization', `Bearer ${soloToken}`),
    ]);

    const participants = await prisma.roundParticipant.findMany({ where: { roundId: roundE.id } });
    const sum = participants.reduce((acc, p) => acc + p.units, 0);
    const finalRound = await prisma.round.findUniqueOrThrow({ where: { id: roundE.id } });
    expect(finalRound.unitsCount).toBe(sum);
  });

  it('BUG-001: a join queued behind a long-held round lock (> 5s) still succeeds, never 500', async () => {
    const svc = await prisma.service.create({
      data: { name: 'Lock-wait Svc', slug: `lw-${randomInviteCode().toLowerCase()}`, description: 'x', category: 'Home Care', active: true },
    });
    try {
      const round = await createRound(societyA.id, svc.id, 'OPEN');
      let lockHeld!: () => void;
      const held = new Promise<void>((resolve) => {
        lockHeld = resolve;
      });
      // Another writer holds the exclusive round row lock for 6.5s (longer than
      // Prisma's default 5s interactive-transaction timeout).
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Round" WHERE "id" = ${round.id} FOR UPDATE`;
          lockHeld();
          await new Promise((r) => setTimeout(r, 6_500));
        },
        { timeout: 20_000 },
      );
      await held;

      const res = await request(app.getHttpServer())
        .post(`/rounds/${round.id}/join`)
        .set('Authorization', `Bearer ${token}`)
        .send({ units: 3 });
      await holder;

      expect(res.status).toBe(201);
      expect((await prisma.round.findUniqueOrThrow({ where: { id: round.id } })).unitsCount).toBe(3);
    } finally {
      await prisma.service.delete({ where: { id: svc.id } });
    }
  }, 30_000);
});
