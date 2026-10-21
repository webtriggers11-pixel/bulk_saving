import { Controller, Get, Headers, HttpCode, HttpStatus, NotFoundException, Post, Query, Req, Res, UnauthorizedException, Logger } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ErrorCode } from '../../common/error-codes';
import { whatsAppCloudConfig } from '../whatsapp/whatsapp.config';
import { WaLoginService } from './wa-login.service';
import { parseWebhookEvents } from './wa-webhook.parser';
import { verifyMetaSignature } from './wa-webhook.signature';

/**
 * Meta's door (FEAT-027, ADR-0038). Exists as a real route only in cloud mode: without an
 * app secret there is nothing to verify against, and an unverifiable webhook is not a
 * webhook — it is a way to claim "a message arrived from +91…".
 */
// V2 P2: Meta delivers messages AND sent/delivered/read statuses (several per login) from a
// small pool of addresses; the global 120/min throttler would answer 429, Meta would retry and,
// sustained, disable the subscription. This door is authenticated by the HMAC, not by rate.
@SkipThrottle()
@Controller('webhooks/whatsapp')
export class WaWebhookController {
  private readonly logger = new Logger(WaWebhookController.name);

  constructor(private readonly wa: WaLoginService) {}

  /** The subscribe handshake: echo the challenge as plain text when the verify token matches. */
  @Get()
  verify(
    @Res() res: Response,
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): void {
    const config = whatsAppCloudConfig();
    if (!config) {
      res.status(HttpStatus.NOT_FOUND).json({ success: false, error: { code: ErrorCode.NOT_FOUND, message: 'Not found.' } });
      return;
    }
    if (mode === 'subscribe' && token === config.verifyToken && typeof challenge === 'string') {
      res.status(HttpStatus.OK).type('text/plain').send(challenge);
      return;
    }
    res.status(HttpStatus.FORBIDDEN).json({ success: false, error: { code: ErrorCode.FORBIDDEN, message: 'Verify token mismatch.' } });
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature?: string): Promise<{ received: true }> {
    const config = whatsAppCloudConfig();
    if (!config) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Not found.' });
    }
    if (!verifyMetaSignature(req.rawBody, signature, config.appSecret)) {
      throw new UnauthorizedException({ code: ErrorCode.WHATSAPP_WEBHOOK_SIGNATURE, message: 'Webhook signature mismatch.' });
    }
    const events = parseWebhookEvents(req.body);
    for (const event of events) {
      if (event.phoneNumberId && event.phoneNumberId !== config.phoneNumberId) {
        // Signed by our app, but for another number on the same account: not ours to act on.
        this.logger.warn(`WhatsApp webhook for another phone-number id (${event.phoneNumberId}); ignored`);
        continue;
      }
      // Awaited: a failure answers 5xx and Meta redelivers (the message id is forgotten first).
      await this.wa.handleInbound(event);
    }
    return { received: true };
  }
}
