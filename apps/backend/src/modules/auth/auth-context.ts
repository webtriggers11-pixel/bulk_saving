import {
  createParamDecorator,
  ExecutionContext,
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
  societyId: string;
  role: Role;
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
