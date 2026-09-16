import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import type { AuthedRequest } from './auth-context';
import { ROLES_KEY } from './roles.decorator';

/**
 * Enforces `@Roles(...)`. Runs AFTER {@link AccessTokenGuard}, so `req.auth` is
 * present. A caller whose role is not allowed gets 403 FORBIDDEN.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const auth = req.auth;
    if (!auth || !required.includes(auth.role)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Insufficient role for this resource.',
      });
    }
    return true;
  }
}
