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

  afterAll(async () => {
    await redis.del(`refresh:${resident.id}`);
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
   * FEAT-013 / ADR-0024. Two halves have to agree for a session to actually be
   * permanent: the TOKEN must carry no `exp`, and the Redis HANDLE must carry no TTL —
   * at issue AND after every rotation. Getting one right and not the other produces a
   * session that expires while every signature claims it cannot, so each half is
   * asserted separately and the handle is re-checked after a rotation.
   */
  describe('lifetime sessions (ADR-0024)', () => {
    const handle = () => redis.ttl(`refresh:${resident.id}`);

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

    it('accepts a refresh token minted years ago', async () => {
      // Not a token we waited for — one signed as if it were. `noTimestamp` lets the
      // payload's own `iat` stand, so this is genuinely a token from 2019.
      const jti = `jti_${randomBytes(4).toString('hex')}`;
      const ancient = await jwt.signAsync(
        { sub: resident.id, jti, iat: Math.floor(new Date('2019-01-01').getTime() / 1000) },
        { secret: process.env.JWT_REFRESH_SECRET as string, algorithm: 'HS256', noTimestamp: true },
      );
      await redis.set(`refresh:${resident.id}`, jti);

      const rotated = await service.refresh(ancient);
      expect(typeof rotated.accessToken).toBe('string');
    });

    it('still ends the session when the handle is deleted — the kill switch survives', async () => {
      const tokens = await service.issueTokens(resident);
      await redis.del(`refresh:${resident.id}`);

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
