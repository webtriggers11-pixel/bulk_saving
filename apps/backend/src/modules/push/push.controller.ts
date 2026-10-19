import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { PushConfigDto } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { type AuthContext, CurrentAuth } from '../auth/auth-context';
import { PushSubscribeDto, PushUnsubscribeDto } from './push.dto';
import { PushService } from './push.service';

/**
 * Web push opt-in (FEAT-020, ADR-0032). Every route needs a signed-in resident; the
 * resident and society come from the token, never from the body (ADR-0003).
 */
@Controller('push')
@UseGuards(AccessTokenGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  /** The VAPID public key the browser subscribes with; null when push is off here. */
  @Get('vapid-public-key')
  config(): PushConfigDto {
    return { publicKey: this.push.publicKey };
  }

  /** Turn notifications on for this device — or refresh its keys or colour. Idempotent. */
  @Post('subscriptions')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @CurrentAuth() ctx: AuthContext,
    @Body() dto: PushSubscribeDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<{ subscribed: true }> {
    if (!this.push.enabled) {
      throw new ServiceUnavailableException({
        code: ErrorCode.PUSH_DISABLED,
        message: 'Notifications are not available on this server.',
      });
    }
    await this.push.subscribe(ctx.residentId, ctx.societyId, dto, userAgent);
    return { subscribed: true };
  }

  /** Turn notifications off for this device. Idempotent; another resident's device is untouched. */
  @Delete('subscriptions')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@CurrentAuth() ctx: AuthContext, @Body() dto: PushUnsubscribeDto): Promise<{ subscribed: false }> {
    await this.push.unsubscribe(ctx.residentId, dto.endpoint);
    return { subscribed: false };
  }
}
