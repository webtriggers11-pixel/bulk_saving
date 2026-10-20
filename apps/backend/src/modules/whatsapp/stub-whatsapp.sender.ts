import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { redactPhone } from '../notifications/notification-channel';
import { STUB_BUSINESS_NUMBER, type WhatsAppLoginMode } from './whatsapp.config';
import { cloudButtonsPayload, type WaButton, type WhatsAppSender } from './whatsapp-sender';

/** What the stub last "sent" to a phone — what the dev simulator shows as WhatsApp's reply. */
export interface DevWaPrompt {
  body: string;
  buttons: WaButton[];
  at: string;
}

/** DEV ONLY (ADR-0037's gate): the stub's last prompt per phone, for the simulator. */
export function devWaPromptKey(phone: string): string {
  return `dev:wa:last-prompt:${phone}`;
}

export const DEV_WA_PROMPT_TTL_SECONDS = 180;

/**
 * The sender bound when there is no Meta app (FEAT-027). In `stub` mode it logs a redacted
 * line and stashes the prompt so `GET /dev/whatsapp/prompt` can show it; in `off` mode it
 * refuses — nothing should be asking it, because the login service checks the mode first.
 */
@Injectable()
export class StubWhatsAppSender implements WhatsAppSender {
  private readonly logger = new Logger(StubWhatsAppSender.name);

  readonly businessNumber: string | null;

  constructor(
    private readonly redis: RedisService,
    readonly mode: Exclude<WhatsAppLoginMode, 'cloud'>,
  ) {
    this.businessNumber = mode === 'stub' ? STUB_BUSINESS_NUMBER : null;
  }

  async sendButtons(to: string, body: string, buttons: WaButton[]): Promise<void> {
    // The same validation the real adapter applies, so a prompt that would be refused by
    // Meta is refused here too — the stub must not pass what the Cloud API would not.
    cloudButtonsPayload(to, body, buttons);
    await this.record(to, { body, buttons, at: new Date().toISOString() });
  }

  async sendText(to: string, body: string): Promise<void> {
    await this.record(to, { body, buttons: [], at: new Date().toISOString() });
  }

  private async record(to: string, prompt: DevWaPrompt): Promise<void> {
    if (this.mode !== 'stub') {
      throw new Error('WhatsApp sign-in is switched off; nothing can be sent.');
    }
    this.logger.log(`[DEV ONLY] WhatsApp → ${redactPhone(to)}: ${prompt.body}${prompt.buttons.length ? ` [${prompt.buttons.map((b) => b.title).join(' | ')}]` : ''}`);
    await this.redis.set(devWaPromptKey(to), JSON.stringify(prompt), 'EX', DEV_WA_PROMPT_TTL_SECONDS);
  }
}
