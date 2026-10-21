import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Query, Req } from '@nestjs/common';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import type { Request } from 'express';
import { normalisePhone } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { RedisService } from '../../redis/redis.service';
import { WaLoginService } from '../auth/wa-login.service';
import { devWaPromptKey, type DevWaPrompt } from '../whatsapp/stub-whatsapp.sender';
import { assertLoopback } from './loopback';

const PHONE = /^\+?[0-9][0-9\s().-]{5,24}$/;

/** "I sent this text from this number" — what the webhook would deliver. */
export class DevWaInboundDto {
  @Matches(PHONE, { message: 'from must be a phone number.' })
  from!: string;

  @IsString()
  @Length(1, 1024)
  text!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;
}

/** "I tapped this button from this number". */
export class DevWaTapDto {
  @Matches(PHONE, { message: 'from must be a phone number.' })
  from!: string;

  @IsString()
  @Length(1, 256)
  buttonId!: string;
}

/**
 * DEV ONLY (FEAT-027, ADR-0038 §6; the gates of ADR-0037): the WhatsApp side of a sign-in,
 * played by hand. Each route hands {@link WaLoginService.handleInbound} the SAME event the
 * signed webhook would — so what the simulator shows is what the real thing will do — and
 * reads back what the stub sender "replied". Registered only inside DevToolsModule;
 * loopback callers only.
 */
@Controller('dev/whatsapp')
export class DevWhatsAppController {
  constructor(
    private readonly wa: WaLoginService,
    private readonly redis: RedisService,
  ) {}

  @Post('inbound')
  @HttpCode(HttpStatus.OK)
  async inbound(@Req() req: Pick<Request, 'socket'>, @Body() dto: DevWaInboundDto): Promise<{ handled: true }> {
    assertLoopback(req);
    const from = this.waId(dto.from);
    await this.wa.handleInbound({
      kind: 'text',
      messageId: `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      from,
      profileName: dto.name ?? null,
      text: dto.text,
      phoneNumberId: null,
    });
    return { handled: true };
  }

  @Post('tap')
  @HttpCode(HttpStatus.OK)
  async tap(@Req() req: Pick<Request, 'socket'>, @Body() dto: DevWaTapDto): Promise<{ handled: true }> {
    assertLoopback(req);
    await this.wa.handleInbound({
      kind: 'button',
      messageId: `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      from: this.waId(dto.from),
      profileName: null,
      buttonId: dto.buttonId,
      title: '',
      phoneNumberId: null,
    });
    return { handled: true };
  }

  /** What the business last "sent" to this phone, or 404. */
  @Get('prompt')
  async prompt(@Req() req: Pick<Request, 'socket'>, @Query('phone') raw?: string): Promise<DevWaPrompt> {
    assertLoopback(req);
    const phone = typeof raw === 'string' ? normalisePhone(raw) : null;
    if (!phone) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'phone must be a valid phone number.' });
    }
    const stored = await this.redis.get(devWaPromptKey(phone));
    if (!stored) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Nothing has been sent to this phone in the last three minutes.' });
    }
    return JSON.parse(stored) as DevWaPrompt;
  }

  /** The webhook's `from` is a wa_id: digits, no `+`. */
  private waId(raw: string): string {
    const phone = normalisePhone(raw);
    if (!phone) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'from must be a valid phone number.' });
    }
    return phone.slice(1);
  }
}
