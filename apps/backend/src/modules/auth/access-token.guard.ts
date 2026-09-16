import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ErrorCode } from '../../common/error-codes';
import type { AuthedRequest } from './auth-context';
import { AuthService } from './auth.service';

/**
 * Validates the `Authorization: Bearer <jwt>` access token and attaches the
 * trusted {@link AuthContext} (residentId, societyId, role) to the request.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['authorization'];
    const raw = Array.isArray(header) ? header[0] : header;
    const token = raw && raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : null;
    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Missing bearer token.',
      });
    }
    req.auth = await this.auth.verifyAccessToken(token);
    return true;
  }
}
