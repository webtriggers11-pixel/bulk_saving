import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import type { AuthedRequest } from './auth-context';
import { ROLES_KEY } from './roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Enforces `@Roles(...)`. Runs AFTER {@link AccessTokenGuard}, so `req.auth` is
 * present. A caller whose role is not allowed gets 403 FORBIDDEN.
 *
 * FEAT-035 V2 P1: an admin-only route also re-reads the caller's row. An access token lives
 * for one `JWT_ACCESS_TTL_SECONDS` after its owner is switched off or demoted, and a token
 * alone was enough to switch yourself back on and then act on the admin who switched you off.
 * One primary-key read per admin request closes that: a switched-off admin gets 403
 * ACCOUNT_DISABLED, a demoted one 403 FORBIDDEN, on the very next admin request.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    // PrismaService, not ResidentsService: `@UseGuards(RolesGuard)` builds the guard in EVERY
    // controller's own module, and only the global Prisma module is visible from all of them.
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const adminOnly = required.every((role) => role === Role.SUPER_ADMIN);
    if (adminOnly) {
      const fresh = await this.prisma.resident.findUnique({ where: { id: auth.residentId }, select: { active: true, role: true } });
      if (!fresh || fresh.active === false) {
        throw new ForbiddenException({ code: ErrorCode.ACCOUNT_DISABLED, message: 'This account has been switched off.' });
      }
      if (fresh.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, message: 'Insufficient role for this resource.' });
      }
    }
    return true;
  }
}
