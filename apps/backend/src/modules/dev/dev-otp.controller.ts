import { BadRequestException, Controller, ForbiddenException, Get, NotFoundException, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { normalisePhone } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { RedisService } from '../../redis/redis.service';
import { devOtpKey } from '../notifications/stub-sms.channel';

/**
 * DEV ONLY (FEAT-026, ADR-0037): the code the stub SMS channel just "sent" to a phone, so a
 * developer's browser can show it as a toast instead of someone reading Redis by hand.
 *
 * This controller is never registered outside `OTP_DEV_LOG=true` + non-production (see
 * {@link DevToolsModule}); in production the route simply does not exist. It reads the same
 * short-lived key the E2E harness reads (`dev:last-otp:<phone>`, 120s), and the auth
 * responses stay exactly as ADR-0020 left them — the code never rides on them.
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

@Controller('dev')
export class DevOtpController {
  constructor(private readonly redis: RedisService) {}

  @Get('otp')
  async lastOtp(@Req() req: Pick<Request, 'socket'>, @Query('phone') raw?: string): Promise<{ code: string }> {
    // Nest listens on every interface and CORS stops browsers, not curl: this developer's
    // own machine only (V2 P3). The SOCKET address, not `req.ip` — the latter honours proxy
    // headers under TRUST_PROXY and could be told it is loopback (V2 r2 P3).
    if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) {
      throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, message: 'The dev OTP route answers the local machine only.' });
    }
    const phone = typeof raw === 'string' ? normalisePhone(raw) : null;
    if (!phone) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'phone must be a valid phone number.' });
    }
    const code = await this.redis.get(devOtpKey(phone));
    if (!code) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'No code has been sent to this phone in the last two minutes.' });
    }
    return { code };
  }
}
