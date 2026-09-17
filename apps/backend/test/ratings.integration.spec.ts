import { INestApplication } from '@nestjs/common';
import type { Resident, Round, RoundStatus, Society, Vendor } from '@prisma/client';
import request from 'supertest';
import type { AdminRoundDetailDto, MyRoundDto, RatingDto, VendorDto } from '@bulk/shared';
import { ErrorCode } from '../src/common/error-codes';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Post-service rating (FEAT-007, ADR-0017). Proves, against real Postgres + Redis:
 *  - only a participant of a DELIVERED round, in their own society, can rate it;
 *  - the FIRST rating moves DELIVERED → RATED through the guarded transition, and a
 *    second rating (or an edit, or a delete) never re-transitions or rolls back;
 *  - `GET /rounds/mine` is the only resident read that shows a non-OPEN round, and
 *    it carries the caller's own rating;
 *  - the admin sees per-participant ratings, a per-round summary, a per-vendor
 *    average and the platform metric — every aggregate asserted against THIS test's
 *    own fixtures, never a platform-wide absolute (suites share one dev DB).
 */
describe('Ratings (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let society: Society;
  let otherSociety: Society;
  let alice: Resident; // participant
  let bob: Resident; // participant
  let carol: Resident; // same society, did NOT join
  let outsider: Resident; // another society
  let admin: Resident;
  let aliceToken: string;
  let bobToken: string;
  let carolToken: string;
  let outsiderToken: string;
  let adminToken: string;
  let vendor: Vendor;

  const serviceIds: string[] = [];
  const suffix = randomInviteCode().toLowerCase();

  const TIERS = [{ threshold: 2, price: 900 }];

  /** A round on its own fresh service, in whatever status the test needs. */
  const createRound = async (status: RoundStatus, societyId = society.id): Promise<Round> => {
    const service = await prisma.service.create({
      data: {
        name: `Rating ${serviceIds.length}`,
        slug: `rt-${serviceIds.length}-${suffix}`,
        description: 'x',
        category: 'Home',
        active: true,
      },
    });
    serviceIds.push(service.id);
    return prisma.round.create({
      data: {
        societyId,
        serviceId: service.id,
        status,
        unitsCount: 0,
        deadline: new Date(Date.now() - 1_000),
        tiers: { create: TIERS },
        ...(status === 'ASSIGNED' || status === 'DELIVERED' || status === 'RATED'
          ? { vendorId: vendor.id, finalPrice: 700, assignedAt: new Date() }
          : {}),
      },
    });
  };

  const addParticipant = async (round: Round, resident: Resident, units = 1): Promise<void> => {
    await prisma.roundParticipant.create({
      data: { roundId: round.id, residentId: resident.id, units },
    });
    await prisma.round.update({
      where: { id: round.id },
      data: { unitsCount: { increment: units } },
    });
  };

  /** A DELIVERED round that alice and bob both joined — the common fixture. */
  const deliveredRoundWithBoth = async (): Promise<Round> => {
    const round = await createRound('DELIVERED');
    await addParticipant(round, alice, 2);
    await addParticipant(round, bob, 1);
    return round;
  };

  const statusOf = async (id: string): Promise<RoundStatus> =>
    (await prisma.round.findUniqueOrThrow({ where: { id } })).status;

  const rate = (roundId: string, token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .put(`/rounds/${roundId}/rating`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);

    society = await prisma.society.create({
      data: { name: 'Rating Society', city: 'Pune', inviteCode: randomInviteCode() },
    });
    otherSociety = await prisma.society.create({
      data: { name: 'Rating Other', city: 'Mumbai', inviteCode: randomInviteCode() },
    });
    const mk = (societyId: string, name: string, role: 'RESIDENT' | 'SUPER_ADMIN' = 'RESIDENT') =>
      prisma.resident.create({
        data: { societyId, phone: randomPhone(), name, role, verifiedAt: new Date() },
      });
    alice = await mk(society.id, 'Alice');
    bob = await mk(society.id, 'Bob');
    carol = await mk(society.id, 'Carol');
    outsider = await mk(otherSociety.id, 'Outsider');
    admin = await mk(society.id, 'Admin', 'SUPER_ADMIN');

    aliceToken = (await auth.issueTokens(alice)).accessToken;
    bobToken = (await auth.issueTokens(bob)).accessToken;
    carolToken = (await auth.issueTokens(carol)).accessToken;
    outsiderToken = (await auth.issueTokens(outsider)).accessToken;
    adminToken = (await auth.issueTokens(admin)).accessToken;

    vendor = await prisma.vendor.create({
      data: { name: `Rating Vendor ${suffix}`, phone: randomPhone() },
    });
  });

  afterAll(async () => {
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    await prisma.society.deleteMany({ where: { id: { in: [society.id, otherSociety.id] } } });
    await prisma.vendor.delete({ where: { id: vendor.id } });
    await app.close();
  });

  describe('PUT /rounds/:id/rating', () => {
    it('a participant rates a delivered round, and the FIRST rating flips it to RATED', async () => {
      const round = await deliveredRoundWithBoth();

      const res = await rate(round.id, aliceToken, { stars: 5, comment: '  Spotless job.  ' }).expect(200);

      const rating = res.body.data as RatingDto;
      expect(rating.stars).toBe(5);
      expect(rating.comment).toBe('Spotless job.'); // trimmed
      expect(rating.residentId).toBe(alice.id);
      expect(await statusOf(round.id)).toBe('RATED');
    });

    it('a second participant rating does not re-transition (and does not 409)', async () => {
      const round = await deliveredRoundWithBoth();
      await rate(round.id, aliceToken, { stars: 4 }).expect(200);
      expect(await statusOf(round.id)).toBe('RATED');

      await rate(round.id, bobToken, { stars: 2 }).expect(200);

      expect(await statusOf(round.id)).toBe('RATED');
      expect(await prisma.rating.count({ where: { roundId: round.id } })).toBe(2);
    });

    it('re-rating replaces the caller’s own rating rather than adding one', async () => {
      const round = await deliveredRoundWithBoth();
      await rate(round.id, aliceToken, { stars: 2, comment: 'Late.' }).expect(200);

      const second = await rate(round.id, aliceToken, { stars: 4, comment: 'Sorted it.' }).expect(200);

      expect((second.body.data as RatingDto).stars).toBe(4);
      expect(await prisma.rating.count({ where: { roundId: round.id, residentId: alice.id } })).toBe(1);
    });

    it('an empty comment is stored as null, not as an empty string', async () => {
      const round = await deliveredRoundWithBoth();
      const res = await rate(round.id, aliceToken, { stars: 3, comment: '   ' }).expect(200);
      expect((res.body.data as RatingDto).comment).toBeNull();
    });

    it('a RATED round can still be rated by someone who has not yet', async () => {
      const round = await createRound('RATED');
      await addParticipant(round, alice, 1);

      await rate(round.id, aliceToken, { stars: 5 }).expect(200);

      expect(await statusOf(round.id)).toBe('RATED');
    });

    it('DENIES a resident of the society who did not join: 403 NOT_A_PARTICIPANT', async () => {
      const round = await deliveredRoundWithBoth();

      const res = await rate(round.id, carolToken, { stars: 5 }).expect(403);

      expect(res.body.error.code).toBe(ErrorCode.NOT_A_PARTICIPANT);
      expect(await prisma.rating.count({ where: { roundId: round.id } })).toBe(0);
    });

    it('DENIES another society with 404, not 403 (tenant isolation)', async () => {
      const round = await deliveredRoundWithBoth();

      const res = await rate(round.id, outsiderToken, { stars: 5 }).expect(404);

      expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
    });

    it('REFUSES a round that is not delivered: 409 ROUND_NOT_DELIVERED, writing nothing', async () => {
      for (const status of ['OPEN', 'CLOSED_MET', 'CLOSED_EXPIRED', 'ASSIGNED', 'CANCELLED'] as const) {
        const round = await createRound(status);
        await addParticipant(round, alice, 1);

        const res = await rate(round.id, aliceToken, { stars: 5 }).expect(409);

        expect(res.body.error.code).toBe(ErrorCode.ROUND_NOT_DELIVERED);
        expect(await prisma.rating.count({ where: { roundId: round.id } })).toBe(0);
        expect(await statusOf(round.id)).toBe(status);
      }
    });

    it('validates stars and the comment length', async () => {
      const round = await deliveredRoundWithBoth();

      await rate(round.id, aliceToken, { stars: 0 }).expect(400);
      await rate(round.id, aliceToken, { stars: 6 }).expect(400);
      await rate(round.id, aliceToken, { stars: 4.5 }).expect(400);
      await rate(round.id, aliceToken, {}).expect(400);
      await rate(round.id, aliceToken, { stars: 5, comment: 'x'.repeat(501) }).expect(400);

      expect(await prisma.rating.count({ where: { roundId: round.id } })).toBe(0);
      expect(await statusOf(round.id)).toBe('DELIVERED');
    });

    it('requires authentication', async () => {
      const round = await deliveredRoundWithBoth();
      await request(app.getHttpServer()).put(`/rounds/${round.id}/rating`).send({ stars: 5 }).expect(401);
    });

    it('unknown round → 404', async () => {
      await rate('does-not-exist', aliceToken, { stars: 5 }).expect(404);
    });
  });

  describe('DELETE /rounds/:id/rating', () => {
    it('removes the caller’s rating; the round STAYS RATED (status never rolls back)', async () => {
      const round = await deliveredRoundWithBoth();
      await rate(round.id, aliceToken, { stars: 5 }).expect(200);

      await request(app.getHttpServer())
        .delete(`/rounds/${round.id}/rating`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(204);

      expect(await prisma.rating.count({ where: { roundId: round.id } })).toBe(0);
      expect(await statusOf(round.id)).toBe('RATED');
    });

    it('404 when there is nothing to remove', async () => {
      const round = await deliveredRoundWithBoth();
      await request(app.getHttpServer())
        .delete(`/rounds/${round.id}/rating`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(404);
    });

    it('does not let one resident delete another’s rating', async () => {
      const round = await deliveredRoundWithBoth();
      await rate(round.id, aliceToken, { stars: 5 }).expect(200);

      await request(app.getHttpServer())
        .delete(`/rounds/${round.id}/rating`)
        .set('Authorization', `Bearer ${bobToken}`)
        .expect(404);

      expect(await prisma.rating.count({ where: { roundId: round.id, residentId: alice.id } })).toBe(1);
    });
  });

  describe('GET /rounds/mine', () => {
    it('returns joined rounds in ANY status, with the caller’s own rating', async () => {
      const delivered = await deliveredRoundWithBoth();
      const open = await createRound('OPEN');
      await addParticipant(open, alice, 3);
      await rate(delivered.id, aliceToken, { stars: 4, comment: 'Good.' }).expect(200);

      const res = await request(app.getHttpServer())
        .get('/rounds/mine')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      const mine = res.body.data as MyRoundDto[];
      const deliveredRow = mine.find((r) => r.id === delivered.id);
      const openRow = mine.find((r) => r.id === open.id);
      expect(deliveredRow?.status).toBe('RATED');
      expect(deliveredRow?.myRating?.stars).toBe(4);
      expect(deliveredRow?.myUnits).toBe(2);
      expect(openRow?.myRating).toBeNull();
    });

    it('never includes a round the caller has not joined', async () => {
      const round = await createRound('DELIVERED');
      await addParticipant(round, bob, 1);

      const res = await request(app.getHttpServer())
        .get('/rounds/mine')
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(200);

      expect((res.body.data as MyRoundDto[]).some((r) => r.id === round.id)).toBe(false);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/rounds/mine').expect(401);
    });
  });

  describe('admin surfacing', () => {
    it('round detail carries each participant’s rating and the round summary', async () => {
      const round = await deliveredRoundWithBoth();
      await rate(round.id, aliceToken, { stars: 5, comment: 'Excellent.' }).expect(200);
      await rate(round.id, bobToken, { stars: 2 }).expect(200);

      const res = await request(app.getHttpServer())
        .get(`/admin/rounds/${round.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const detail = res.body.data as AdminRoundDetailDto;
      const aliceRow = detail.participants.find((p) => p.resident.id === alice.id);
      const bobRow = detail.participants.find((p) => p.resident.id === bob.id);
      expect(aliceRow?.rating).toMatchObject({ stars: 5, comment: 'Excellent.' });
      expect(bobRow?.rating).toMatchObject({ stars: 2, comment: null });
      expect(detail.ratings).toEqual({ average: 3.5, count: 2 });
    });

    it('shows null ratings on a round nobody rated', async () => {
      const round = await deliveredRoundWithBoth();

      const res = await request(app.getHttpServer())
        .get(`/admin/rounds/${round.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const detail = res.body.data as AdminRoundDetailDto;
      expect(detail.ratings).toEqual({ average: null, count: 0 });
      expect(detail.participants.every((p) => p.rating === null)).toBe(true);
    });

    it('DENIES the admin round detail to a resident token', async () => {
      const round = await deliveredRoundWithBoth();
      await request(app.getHttpServer())
        .get(`/admin/rounds/${round.id}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .expect(403);
    });

    it('vendor list carries the average of THIS vendor’s rounds and the count', async () => {
      const round = await deliveredRoundWithBoth();
      await rate(round.id, aliceToken, { stars: 5 }).expect(200);
      await rate(round.id, bobToken, { stars: 4 }).expect(200);

      const res = await request(app.getHttpServer())
        .get('/admin/vendors')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const mine = (res.body.data as VendorDto[]).find((v) => v.id === vendor.id);
      expect(mine?.ratingCount).toBeGreaterThanOrEqual(2);
      expect(mine?.averageRating).not.toBeNull();
      expect(mine!.averageRating!).toBeGreaterThan(0);
      expect(mine!.averageRating!).toBeLessThanOrEqual(5);
    });

    it('dashboard reports the platform rating metric, and it MOVES when a rating lands', async () => {
      const before = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const countBefore = before.body.data.ratings.count as number;

      const round = await deliveredRoundWithBoth();
      await rate(round.id, aliceToken, { stars: 5 }).expect(200);

      const after = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // A delta, not an absolute: parallel suites share this dev database.
      expect(after.body.data.ratings.count).toBe(countBefore + 1);
      expect(after.body.data.ratings.average).not.toBeNull();
    });
  });
});
