import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Ip,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import type { AuthMethods, WaStartResponse, WaStatusResponse } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { SocietiesService } from '../societies/societies.service';
import { AdminWaStartDto, WaStartDto } from './wa-login.dto';
import { WaLoginService, type WaStartOutcome } from './wa-login.service';

/**
 * Sign in with WhatsApp — the browser's three calls (FEAT-027, ADR-0038). The WhatsApp side
 * arrives through {@link WaWebhookController}; the tokens come from the same AuthService as
 * the OTP doors, so a session started here is a session like any other.
 */
@Controller()
export class WaLoginController {
  constructor(
    private readonly societies: SocietiesService,
    private readonly wa: WaLoginService,
  ) {}

  /** Which methods this server offers. The web shows the WhatsApp button only when told to. */
  @Get('auth/methods')
  methods(): AuthMethods {
    return { whatsapp: this.wa.enabled };
  }

  @Post('auth/wa/start')
  @HttpCode(HttpStatus.OK)
  async start(@Body() dto: WaStartDto, @Ip() clientIp: string, @Headers('user-agent') userAgent?: string): Promise<WaStartResponse> {
    const society = await this.societies.findByInviteCode(dto.inviteCode);
    if (!society) {
      throw new BadRequestException({ code: ErrorCode.INVALID_INVITE_CODE, message: 'Unknown invite code.' });
    }
    // societyId is bound from the invite code, now, never from the WhatsApp side (ADR-0003).
    return this.unwrap(await this.wa.start({ door: 'resident', societyId: society.id, clientIp, userAgent }));
  }

  /**
   * The admin door (ADR-0023): no body, no phone yet, nothing to leak. Whether the number
   * that eventually answers is an administrator is decided at token time, in `status`.
   */
  @Post('auth/admin/wa/start')
  @HttpCode(HttpStatus.OK)
  async startAdmin(@Body() _dto: AdminWaStartDto, @Ip() clientIp: string, @Headers('user-agent') userAgent?: string): Promise<WaStartResponse> {
    void _dto;
    return this.unwrap(await this.wa.start({ door: 'admin', clientIp, userAgent }));
  }

  // The one GET that can carry tokens: never cacheable (V2 P3).
  @Get('auth/wa/status/:requestId')
  @Header('Cache-Control', 'no-store')
  status(@Param('requestId') requestId: string): Promise<WaStatusResponse> {
    return this.wa.status(requestId);
  }

  private unwrap(outcome: WaStartOutcome): WaStartResponse {
    if (outcome.result === 'DISABLED') {
      throw new NotFoundException({ code: ErrorCode.WHATSAPP_LOGIN_DISABLED, message: 'Signing in with WhatsApp is not available here.' });
    }
    if (outcome.result === 'RATE_LIMITED') {
      throw new HttpException(
        { code: ErrorCode.OTP_RATE_LIMITED, message: 'Too many sign-in attempts. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const { result: _result, ...response } = outcome;
    void _result;
    return response;
  }
}
