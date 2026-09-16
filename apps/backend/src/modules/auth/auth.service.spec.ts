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
});
