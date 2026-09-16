import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Resident } from '@prisma/client';
import type { AuthTokens, Role } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { RedisService } from '../../redis/redis.service';
import { ResidentsService } from '../residents/residents.service';
import type { AuthContext } from './auth-context';

/** Claims carried by an access token. */
export interface AccessTokenPayload {
  sub: string;
  societyId: string;
  role: Role;
}

/** Claims carried by a refresh token — `jti` is the rotation handle. */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Issues and verifies JWTs (ADR-0007). Access tokens are short-lived and carry
 * the tenant/role claims; refresh tokens are long-lived, rotated on every use,
 * and their current id is tracked in Redis so a reused/old token is rejected.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly residents: ResidentsService,
  ) {}

  // Secrets come from validated env config only — NO hardcoded fallback. Boot-time
  // validation (env.validation.ts) guarantees these are present and non-trivial;
  // this throw is a defensive backstop for non-Nest entrypoints (e.g. unit tests).
  private get accessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured.');
    }
    return secret;
  }

  private get refreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured.');
    }
    return secret;
  }

  /** Access-token lifetime in seconds (default 15 min). */
  private get accessTtlSeconds(): number {
    const raw = process.env.JWT_ACCESS_TTL_SECONDS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60;
  }

  private refreshKey(residentId: string): string {
    return `refresh:${residentId}`;
  }

  /** Mint a fresh access + refresh pair and record the refresh id as current. */
  async issueTokens(resident: Resident): Promise<AuthTokens> {
    const jti = randomUUID();
    const tokens = await this.signPair(resident.id, resident.societyId, resident.role as Role, jti);
    await this.redis.set(this.refreshKey(resident.id), jti, 'EX', REFRESH_TTL_SECONDS);
    return tokens;
  }

  private async signPair(
    residentId: string,
    societyId: string,
    role: Role,
    jti: string,
  ): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: residentId, societyId, role } satisfies AccessTokenPayload,
      { secret: this.accessSecret, expiresIn: this.accessTtlSeconds, algorithm: 'HS256' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: residentId, jti } satisfies RefreshTokenPayload,
      { secret: this.refreshSecret, expiresIn: REFRESH_TTL_SECONDS, algorithm: 'HS256' },
    );
    return { accessToken, refreshToken };
  }

  /** Verify an access token and derive the trusted {@link AuthContext}. */
  async verifyAccessToken(token: string): Promise<AuthContext> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Invalid or expired access token.',
      });
    }
    return { residentId: payload.sub, societyId: payload.societyId, role: payload.role };
  }

  /**
   * Rotate a refresh token. The new id atomically replaces the stored one via a
   * Redis compare-and-set; a token whose id no longer matches (reused/old, or a
   * concurrent rotation already ran) is rejected with TOKEN_REVOKED.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_REVOKED,
        message: 'Refresh token is invalid or expired.',
      });
    }

    const resident = await this.residents.findById(payload.sub);
    if (!resident) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_REVOKED,
        message: 'Refresh token is no longer valid.',
      });
    }

    const newJti = randomUUID();
    // Atomic compare-and-set: only rotate if the presented id is still current.
    const rotated = (await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3]); return 1 else return 0 end",
      1,
      this.refreshKey(resident.id),
      payload.jti,
      newJti,
      String(REFRESH_TTL_SECONDS),
    )) as number;

    if (rotated !== 1) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_REVOKED,
        message: 'Refresh token has already been used.',
      });
    }

    return this.signPair(resident.id, resident.societyId, resident.role as Role, newJti);
  }
}
