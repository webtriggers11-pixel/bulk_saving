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

/**
 * Claims carried by a refresh token — `jti` is the rotation handle, `sid` the session
 * (one per device sign-in, ADR-0034). A token with no `sid` was issued before BUG-017
 * and is still honoured: its first rotation moves it onto a session of its own.
 */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  sid?: string;
}

/**
 * Rotation is a compare-and-set on the stored id. KEYS[1] is the handle the token
 * presents (its own session's, or the pre-BUG-017 per-resident key), KEYS[2] the handle
 * the NEW token will carry — the same key, except when a legacy token is being moved
 * onto a session of its own — and KEYS[3] the resident's session index. `ARGV[3]` is the
 * new handle's lifetime in seconds, where `0` means "no expiry" (FEAT-013) — and `SET`
 * without `KEEPTTL` clears any TTL the key already carried, so a session cannot inherit
 * an expiry from a token issued under an older policy. The index follows the same clock.
 */
/**
 * Issuing a session is one step too (V2 P3-1): the handle, its index entry and the
 * index's clock land together, so a crash — or a concurrent kill switch — between them
 * cannot leave a live handle the index does not know about.
 */
const ISSUE_LUA = `
redis.call('sadd', KEYS[2], ARGV[2])
if tonumber(ARGV[3]) > 0 then
  redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[3])
  redis.call('expire', KEYS[2], ARGV[3])
else
  redis.call('set', KEYS[1], ARGV[1])
  redis.call('persist', KEYS[2])
end
return 1`;

const ROTATE_LUA = `
if redis.call('get', KEYS[1]) ~= ARGV[1] then
  return 0
end
if KEYS[1] ~= KEYS[2] then
  redis.call('del', KEYS[1])
end
redis.call('sadd', KEYS[3], ARGV[4])
if tonumber(ARGV[3]) > 0 then
  redis.call('set', KEYS[2], ARGV[2], 'EX', ARGV[3])
  redis.call('expire', KEYS[3], ARGV[3])
else
  redis.call('set', KEYS[2], ARGV[2])
  redis.call('persist', KEYS[3])
end
return 1`;

/**
 * Issues and verifies JWTs (ADR-0007). Access tokens are short-lived and carry
 * the tenant/role claims; refresh tokens do not expire by default (ADR-0024),
 * are rotated on every use, and their current id is tracked in Redis — one handle
 * per SESSION, i.e. per device sign-in (ADR-0034) — so a reused/old token is
 * rejected, and so one device, or every device, can still be signed out.
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

  /**
   * Refresh lifetime in seconds, or `null` for "never expires" — the default (ADR-0024).
   *
   * This is the ONLY clock that could end a session, and by default there isn't one:
   * revocation is {@link revokeSession} / {@link revokeAllSessions} (or deleting the
   * `refresh:<residentId>:<sid>` keys by hand), which takes effect within one
   * access-token lifetime. That is why {@link accessTtlSeconds} staying short is
   * load-bearing now.
   */
  private get refreshTtlSeconds(): number | null {
    const raw = process.env.JWT_REFRESH_TTL_SECONDS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  /** Access-token lifetime in seconds (default 15 min). */
  private get accessTtlSeconds(): number {
    const raw = process.env.JWT_ACCESS_TTL_SECONDS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60;
  }

  /** The pre-BUG-017 handle: one per resident. Only ever READ now, to migrate from. */
  private legacyRefreshKey(residentId: string): string {
    return `refresh:${residentId}`;
  }

  /** One handle per session (ADR-0034). */
  private refreshKey(residentId: string, sid: string): string {
    return `refresh:${residentId}:${sid}`;
  }

  /** The set of a resident's live session ids — what "sign out everywhere" walks. */
  private sessionsKey(residentId: string): string {
    return `sessions:${residentId}`;
  }

  /**
   * Mint a fresh access + refresh pair for a NEW session and record its refresh id as
   * current. Every sign-in is its own session: a second device never touches the first
   * (BUG-017).
   */
  async issueTokens(resident: Resident): Promise<AuthTokens> {
    const sid = randomUUID();
    const jti = randomUUID();
    const tokens = await this.signPair(resident.id, resident.societyId, resident.role as Role, jti, sid);
    // A plain SET (no KEEPTTL) so re-issuing under the lifetime policy drops any
    // expiry an earlier policy left on the key. The index follows the same clock.
    await this.redis.eval(
      ISSUE_LUA,
      2,
      this.refreshKey(resident.id, sid),
      this.sessionsKey(resident.id),
      jti,
      sid,
      String(this.refreshTtlSeconds ?? 0),
    );
    return tokens;
  }

  /**
   * End ONE session — the device that presents this refresh token (sign-out). The
   * token is verified for its signature and its subject only; a token that was already
   * rotated or revoked still names the right session, and ending it again is harmless.
   * Returns false when the token cannot be read at all.
   */
  async revokeSession(residentId: string, refreshToken: string): Promise<boolean> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
        // A sign-out must work for an expiring token that has just expired, too.
        ignoreExpiration: true,
      });
    } catch {
      return false;
    }
    if (payload.sub !== residentId) return false;
    const key = payload.sid ? this.refreshKey(residentId, payload.sid) : this.legacyRefreshKey(residentId);
    await this.redis.del(key);
    if (payload.sid) await this.redis.srem(this.sessionsKey(residentId), payload.sid);
    return true;
  }

  /** End EVERY session of a resident — the kill switch for a lost or shared device. */
  async revokeAllSessions(residentId: string): Promise<number> {
    const index = this.sessionsKey(residentId);
    const sids = await this.redis.smembers(index);
    const keys = [
      ...sids.map((sid) => this.refreshKey(residentId, sid)),
      this.legacyRefreshKey(residentId),
      index,
    ];
    return this.redis.del(...keys);
  }

  private async signPair(
    residentId: string,
    societyId: string,
    role: Role,
    jti: string,
    sid: string,
  ): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: residentId, societyId, role } satisfies AccessTokenPayload,
      { secret: this.accessSecret, expiresIn: this.accessTtlSeconds, algorithm: 'HS256' },
    );
    const refreshTtl = this.refreshTtlSeconds;
    const refreshToken = await this.jwt.signAsync(
      { sub: residentId, jti, sid } satisfies RefreshTokenPayload,
      {
        secret: this.refreshSecret,
        algorithm: 'HS256',
        // Omitted entirely when lifetime: a token with no `exp` claim, rather than one
        // carrying a date far enough away to look like it never expires (ADR-0024).
        ...(refreshTtl === null ? {} : { expiresIn: refreshTtl }),
      },
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
    // A token from before BUG-017 carries no session: this rotation gives it one, and
    // the Lua moves the handle from the per-resident key to the per-session key in the
    // same step, so nobody is asked for another OTP by the fix (ADR-0034).
    const sid = payload.sid ?? randomUUID();
    const currentKey = payload.sid
      ? this.refreshKey(resident.id, payload.sid)
      : this.legacyRefreshKey(resident.id);
    // Atomic compare-and-set: only rotate if the presented id is still current. The
    // lifetime is applied HERE too, not only at issue — a lifetime token guarded by a
    // handle that quietly re-acquired a 30-day TTL on first use is a session that dies
    // while every signature says it cannot (ADR-0024, option 3).
    const rotated = (await this.redis.eval(
      ROTATE_LUA,
      3,
      currentKey,
      this.refreshKey(resident.id, sid),
      this.sessionsKey(resident.id),
      payload.jti,
      newJti,
      String(this.refreshTtlSeconds ?? 0),
      sid,
    )) as number;

    if (rotated !== 1) {
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_REVOKED,
        message: 'Refresh token has already been used.',
      });
    }

    return this.signPair(resident.id, resident.societyId, resident.role as Role, newJti, sid);
  }
}
