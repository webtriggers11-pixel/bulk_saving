import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Role } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';

/**
 * The authenticated caller's context, derived from a verified access token and
 * attached to the request by {@link AccessTokenGuard}. `societyId` here is the
 * ONLY trusted source of tenant scope (ADR-0003) — never the request body.
 */
export interface AuthContext {
  residentId: string;
  /** FEAT-036 (ADR-0046): null for a platform admin, who belongs to no society. */
  societyId: string | null;
  role: Role;
}

/** An {@link AuthContext} that belongs to a society — what every society-scoped handler needs. */
export interface MemberContext extends AuthContext {
  societyId: string;
}

/** Request shape once the access-token guard has run. */
export interface AuthedRequest {
  auth?: AuthContext;
  headers: Record<string, string | string[] | undefined>;
}

/** Param decorator: inject the verified {@link AuthContext} into a handler. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Not authenticated.',
      });
    }
    return req.auth;
  },
);

/**
 * Param decorator for society-scoped handlers (FEAT-036, ADR-0046). Same as
 * {@link CurrentAuth}, but a caller with no society (a platform admin) is refused with
 * 403 `NO_SOCIETY` before the handler runs, so no service ever sees a null tenant.
 */
export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MemberContext => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Not authenticated.',
      });
    }
    return requireMember(req.auth);
  },
);

/** Narrow an {@link AuthContext} to a society member, or answer 403 `NO_SOCIETY`. */
export function requireMember(auth: AuthContext): MemberContext {
  if (auth.societyId === null) {
    throw new ForbiddenException({
      code: ErrorCode.NO_SOCIETY,
      message: 'This is a platform admin account. It does not belong to a society.',
    });
  }
  return { ...auth, societyId: auth.societyId };
}
