import { randomBytes } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Resident } from '@prisma/client';
import { ErrorCode } from '../../common/error-codes';
import { RedisService } from '../../redis/redis.service';
import type { ResidentsService } from '../residents/residents.service';
import { AuthService, type AccessTokenPayload } from './auth.service';

/**
 * AuthService tests against REAL Redis (needs `docker compose up -d`) with a
 * real JwtService and a stubbed resident lookup. Focus: rotating refresh and
 * rejection of a reused refresh token.
 */
describe('AuthService (integration, needs Redis)', () => {
  let redis: RedisService;
  let jwt: JwtService;
  let service: AuthService;

  const resident = {
    id: `res_${randomBytes(4).toString('hex')}`,
    societyId: `soc_${randomBytes(4).toString('hex')}`,
    phone: '+919812345678',
    name: 'Test',
    role: 'RESIDENT',
    verifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Resident;

  const residentsStub = {
    findById: async (id: string) => (id === resident.id ? resident : null),
  } as unknown as ResidentsService;

  beforeAll(() => {
    redis = new RedisService();
    jwt = new JwtService({});
    service = new AuthService(jwt, redis, residentsStub);
  });

  /** The ONE live session handle of this resident (ADR-0034) — the tests here hold one at a time. */
  async function sessionKey(): Promise<string> {
    const sids = await redis.smembers(`sessions:${resident.id}`);
    expect(sids).toHaveLength(1);
    return `refresh:${resident.id}:${sids[0]}`;
  }

  beforeEach(async () => {
    await service.revokeAllSessions(resident.id);
  });

  afterAll(async () => {
    await service.revokeAllSessions(resident.id);
    await redis.quit();
  });

  it('issues an access token carrying sub, societyId and role', async () => {
    const tokens = await service.issueTokens(resident);
    // Same secret the service used — guaranteed present by the test env loader.
    const claims = await jwt.verifyAsync<AccessTokenPayload>(tokens.accessToken, {
      secret: process.env.JWT_ACCESS_SECRET as string,
    });
    expect(claims.sub).toBe(resident.id);
    expect(claims.societyId).toBe(resident.societyId);
    expect(claims.role).toBe('RESIDENT');
  });

  it('rotates the refresh token and rejects a reused one', async () => {
    const first = await service.issueTokens(resident);

    // Rotation succeeds and yields a different refresh token.
    const rotated = await service.refresh(first.refreshToken);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    // The new one works once more...
    const rotatedAgain = await service.refresh(rotated.refreshToken);
    expect(rotatedAgain.refreshToken).not.toBe(rotated.refreshToken);

    // ...but the ORIGINAL (already-used) refresh token is now revoked.
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({
      response: { code: ErrorCode.TOKEN_REVOKED },
    });
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a garbage refresh token', async () => {
    await expect(service.refresh('not-a-jwt')).rejects.toMatchObject({
      response: { code: ErrorCode.TOKEN_REVOKED },
    });
  });

  /**
   * BUG-017 / ADR-0034. "One OTP per device, forever" (ADR-0024) only holds if a second
   * device's sign-in leaves the first device's session alone. With one handle per
   * resident it did not: the second `issueTokens` overwrote the jti, and the first
   * device's next refresh failed the compare-and-set and signed it out.
   */
  describe('per-device sessions (BUG-017, ADR-0034)', () => {
    it("a second device's sign-in does not end the first device's session", async () => {
      const phone = await service.issueTokens(resident);
      const laptop = await service.issueTokens(resident);

      // Both devices keep refreshing, in either order, as long as each presents its own
      // latest token.
      const phoneAgain = await service.refresh(phone.refreshToken);
      const laptopAgain = await service.refresh(laptop.refreshToken);
      expect(typeof phoneAgain.accessToken).toBe('string');
      expect(typeof laptopAgain.accessToken).toBe('string');

      // Reuse is still caught per device: the phone's spent token is dead, the laptop's
      // live one is not.
      await expect(service.refresh(phone.refreshToken)).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_REVOKED },
      });
      await expect(service.refresh(laptopAgain.refreshToken)).resolves.toBeDefined();
    });

    it('never writes the pre-fix per-resident key again (ADR-0034: read, never written)', async () => {
      await service.issueTokens(resident);
      const rotated = await service.refresh((await service.issueTokens(resident)).refreshToken);
      expect(typeof rotated.accessToken).toBe('string');
      expect(await redis.exists(`refresh:${resident.id}`)).toBe(0);
      expect(await redis.smembers(`sessions:${resident.id}`)).toHaveLength(2);
    });

    it("signing out ends this device's session and no other", async () => {
      const phone = await service.issueTokens(resident);
      const laptop = await service.issueTokens(resident);

      expect(await service.revokeSession(resident.id, phone.refreshToken)).toBe(true);
      await expect(service.refresh(phone.refreshToken)).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_REVOKED },
      });
      await expect(service.refresh(laptop.refreshToken)).resolves.toBeDefined();
      // The index forgets the signed-out session, so it does not grow forever.
      expect(await redis.smembers(`sessions:${resident.id}`)).toHaveLength(1);
    });

    it('a sign-out with a token for another resident, or garbage, ends nothing', async () => {
      const phone = await service.issueTokens(resident);
      expect(await service.revokeSession('someone-else', phone.refreshToken)).toBe(false);
      expect(await service.revokeSession(resident.id, 'not-a-jwt')).toBe(false);
      await expect(service.refresh(phone.refreshToken)).resolves.toBeDefined();
    });

    it('the kill switch ends every device at once', async () => {
      const phone = await service.issueTokens(resident);
      const laptop = await service.issueTokens(resident);
      await service.revokeAllSessions(resident.id);
      for (const tokens of [phone, laptop]) {
        await expect(service.refresh(tokens.refreshToken)).rejects.toMatchObject({
          response: { code: ErrorCode.TOKEN_REVOKED },
        });
      }
      expect(await redis.exists(`sessions:${resident.id}`)).toBe(0);
    });

    it('a token issued before the fix (no sid, per-resident handle) still refreshes, and moves onto a session of its own', async () => {
      // Exactly what the old issue path left behind: a per-resident handle and a token
      // carrying only `sub` + `jti`.
      const jti = 'legacy-jti';
      await redis.set(`refresh:${resident.id}`, jti);
      const legacy = await jwt.signAsync(
        { sub: resident.id, jti },
        { secret: process.env.JWT_REFRESH_SECRET as string, algorithm: 'HS256' },
      );

      const rotated = await service.refresh(legacy);
      expect(typeof rotated.accessToken).toBe('string');
      // Migrated: the old key is gone, one session exists, and the new token carries it.
      expect(await redis.exists(`refresh:${resident.id}`)).toBe(0);
      const key = await sessionKey();
      expect(await redis.ttl(key)).toBe(-1);
      const claims = await jwt.verifyAsync<Record<string, unknown>>(rotated.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET as string,
      });
      expect(key.endsWith(`:${String(claims.sid)}`)).toBe(true);
      // ...and the legacy token is spent, like any rotated token.
      await expect(service.refresh(legacy)).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_REVOKED },
      });
    });
  });

  /**
   * FEAT-013 / ADR-0024. Two halves have to agree for a session to actually be
   * permanent: the TOKEN must carry no `exp`, and the Redis HANDLE must carry no TTL —
   * at issue AND after every rotation. Getting one right and not the other produces a
   * session that expires while every signature claims it cannot, so each half is
   * asserted separately and the handle is re-checked after a rotation.
   */
  describe('lifetime sessions (ADR-0024)', () => {
    const handle = async () => redis.ttl(await sessionKey());

    afterEach(() => {
      delete process.env.JWT_REFRESH_TTL_SECONDS;
    });

    it('signs a refresh token with no exp claim, and an access token that still has one', async () => {
      const tokens = await service.issueTokens(resident);

      const refreshClaims = await jwt.verifyAsync<Record<string, unknown>>(tokens.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET as string,
      });
      expect(refreshClaims.exp).toBeUndefined();

      // AC6: the short access token is what makes revocation take effect at all.
      const accessClaims = await jwt.verifyAsync<Record<string, unknown>>(tokens.accessToken, {
        secret: process.env.JWT_ACCESS_SECRET as string,
      });
      expect(typeof accessClaims.exp).toBe('number');
    });

    it('stores the rotation handle with no TTL — at issue and after a rotation', async () => {
      const first = await service.issueTokens(resident);
      // -1 is redis for "key exists, no expiry"; -2 would mean it is not there at all.
      expect(await handle()).toBe(-1);

      await service.refresh(first.refreshToken);
      expect(await handle()).toBe(-1);
    });

    it('is still valid ten years from now, and still refreshes', async () => {
      // The token comes from the REAL issue path. The previous version of this test
      // hand-signed its own and hand-wrote the Redis handle, so it bypassed both
      // halves of the policy it claimed to prove and stayed green with `signPair` and
      // `issueTokens` both reverted to 30 days (V2 P2-4).
      const { refreshToken } = await service.issueTokens(resident);

      const tenYears = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60;
      // `clockTimestamp` asks jsonwebtoken to judge this token against a future clock:
      // with an `exp` of any kind it throws TokenExpiredError, with none it verifies.
      await expect(
        jwt.verifyAsync(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET as string,
          clockTimestamp: tenYears,
        }),
      ).resolves.toMatchObject({ sub: resident.id });

      // ...and the whole path still works, not just the signature.
      const rotated = await service.refresh(refreshToken);
      expect(typeof rotated.accessToken).toBe('string');
    });

    it('still ends the session when the handle is deleted — the kill switch survives', async () => {
      const tokens = await service.issueTokens(resident);
      await redis.del(await sessionKey());

      await expect(service.refresh(tokens.refreshToken)).rejects.toMatchObject({
        response: { code: ErrorCode.TOKEN_REVOKED },
      });
    });

    it('restores an expiring session when JWT_REFRESH_TTL_SECONDS is set', async () => {
      process.env.JWT_REFRESH_TTL_SECONDS = '3600';

      const first = await service.issueTokens(resident);
      const claims = await jwt.verifyAsync<Record<string, unknown>>(first.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET as string,
      });
      expect(typeof claims.exp).toBe('number');

      const ttlAtIssue = await handle();
      expect(ttlAtIssue).toBeGreaterThan(0);
      expect(ttlAtIssue).toBeLessThanOrEqual(3600);

      // And the rotation honours it too, which is the mirror of the lifetime case.
      await service.refresh(first.refreshToken);
      expect(await handle()).toBeGreaterThan(0);
    });

    it('drops an expiry left by an earlier policy when it switches back to lifetime', async () => {
      process.env.JWT_REFRESH_TTL_SECONDS = '3600';
      const expiring = await service.issueTokens(resident);
      expect(await handle()).toBeGreaterThan(0);

      delete process.env.JWT_REFRESH_TTL_SECONDS;
      await service.refresh(expiring.refreshToken);
      // SET without KEEPTTL: the handle must come back persistent, not keep its clock.
      expect(await handle()).toBe(-1);
    });
  });
});
