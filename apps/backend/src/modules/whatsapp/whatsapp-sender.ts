import { Logger } from '@nestjs/common';
import type { WhatsAppCloudConfig, WhatsAppLoginMode } from './whatsapp.config';

/** DI token for the active {@link WhatsAppSender} (tests swap in a capturing fake). */
export const WHATSAPP_SENDER = 'WHATSAPP_SENDER';

/** One reply button. Meta: ≤ 3 per message, `title` ≤ 20 chars, `id` ≤ 256 chars, both unique. */
export interface WaButton {
  id: string;
  title: string;
}

/**
 * Sends messages to a WhatsApp number (FEAT-027, ADR-0038). Only ever used INSIDE a
 * conversation the person started (their login message), so every send here is free and
 * needs no template. Round updates (ADR-0013's fast-follow) will reuse this adapter and
 * add templates there.
 */
export interface WhatsAppSender {
  readonly mode: WhatsAppLoginMode;
  /** The number people message (`wa.me/<this>`): the business number, the stub's placeholder, or null when off. */
  readonly businessNumber: string | null;
  /** An interactive reply-buttons message. `to` is E.164 (`+91…`). */
  sendButtons(to: string, body: string, buttons: WaButton[]): Promise<void>;
  sendText(to: string, body: string): Promise<void>;
}

export const WA_MAX_BUTTONS = 3;
export const WA_MAX_BUTTON_TITLE = 20;
export const WA_MAX_BUTTON_ID = 256;
export const WA_MAX_BODY = 1024;

/** `+91987…` → `91987…`: the Cloud API addresses a person by their wa_id (digits). */
export function toWaId(phone: string): string {
  return phone.replace(/^\+/, '');
}

/** The documented request body for an interactive reply-buttons message. Pure, so it is unit-tested. */
export function cloudButtonsPayload(to: string, body: string, buttons: WaButton[]): Record<string, unknown> {
  if (buttons.length === 0 || buttons.length > WA_MAX_BUTTONS) {
    throw new Error(`WhatsApp allows 1–${WA_MAX_BUTTONS} reply buttons, got ${buttons.length}`);
  }
  if (body.length > WA_MAX_BODY) {
    throw new Error(`WhatsApp body text is limited to ${WA_MAX_BODY} characters`);
  }
  const titles = new Set<string>();
  const ids = new Set<string>();
  for (const button of buttons) {
    if (button.title.length === 0 || button.title.length > WA_MAX_BUTTON_TITLE) {
      throw new Error(`WhatsApp button titles are 1–${WA_MAX_BUTTON_TITLE} characters: "${button.title}"`);
    }
    if (button.id.length === 0 || button.id.length > WA_MAX_BUTTON_ID) {
      throw new Error('WhatsApp button ids are 1–256 characters');
    }
    if (titles.has(button.title) || ids.has(button.id)) {
      throw new Error('WhatsApp button titles and ids must be unique within a message');
    }
    titles.add(button.title);
    ids.add(button.id);
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId(to),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
    },
  };
}

export function cloudTextPayload(to: string, body: string): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWaId(to),
    type: 'text',
    text: { preview_url: false, body },
  };
}

/** A Cloud API refusal. The message never carries the access token or the recipient. */
export class WhatsAppSendError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(`WhatsApp Cloud API answered ${status}: ${detail}`);
    this.name = 'WhatsAppSendError';
  }
}

/** How long one Graph API call may take. A webhook handler awaits this; Meta's own timeout is longer. */
export const CLOUD_API_TIMEOUT_MS = 8_000;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Meta's WhatsApp Cloud API over Node's own `fetch` (no SDK, no dependency):
 * `POST https://graph.facebook.com/<version>/<phoneNumberId>/messages` with a Bearer token.
 */
export class CloudApiWhatsAppSender implements WhatsAppSender {
  readonly mode = 'cloud' as const;
  readonly businessNumber: string;
  private readonly logger = new Logger(CloudApiWhatsAppSender.name);

  constructor(
    private readonly config: WhatsAppCloudConfig,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {
    this.businessNumber = config.businessNumber;
  }

  get endpoint(): string {
    return `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`;
  }

  sendButtons(to: string, body: string, buttons: WaButton[]): Promise<void> {
    return this.post(cloudButtonsPayload(to, body, buttons));
  }

  sendText(to: string, body: string): Promise<void> {
    return this.post(cloudTextPayload(to, body));
  }

  private async post(payload: Record<string, unknown>): Promise<void> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.accessToken}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(CLOUD_API_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Meta's error body names the problem (`error.message`, `error.code`); keep that, and
      // only that — a body echoing the request would carry the recipient's number.
      let detail = `HTTP ${response.status}`;
      try {
        const parsed = (await response.json()) as { error?: { message?: string; code?: number; error_subcode?: number } };
        if (parsed.error?.message) {
          detail = `${parsed.error.message} (code ${parsed.error.code ?? '?'}${parsed.error.error_subcode ? `/${parsed.error.error_subcode}` : ''})`;
        }
      } catch {
        /* not JSON — the status is the detail */
      }
      this.logger.warn(`Cloud API send failed: ${detail}`);
      throw new WhatsAppSendError(response.status, detail);
    }
  }
}
