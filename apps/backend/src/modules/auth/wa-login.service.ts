import { randomBytes, randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Resident } from '@prisma/client';
import { normalisePhone, whatsAppLoginMessage, WA_LOGIN_TTL_SECONDS, type WaStartResponse, type WaStatusResponse } from '@bulk/shared';
import { RedisService } from '../../redis/redis.service';
import { redactPhone } from '../notifications/notification-channel';
import { toResidentDto } from '../residents/residents.mapper';
import { ResidentsService } from '../residents/residents.service';
import { WHATSAPP_SENDER, type WhatsAppSender } from '../whatsapp/whatsapp-sender';
import { AuthService } from './auth.service';
import { ipBucket } from './otp.service';
import { describeDevice } from './wa-device';
import type { WaInboundEvent } from './wa-webhook.parser';

export type WaDoor = 'resident' | 'admin';

/** No 0/O/1/I: the code is read off a phone screen and typed by nobody, but it is SEEN. */
export const WA_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const WA_CODE_LENGTH = 6;
/** The code inside a message, in any case, with or without the dash spoken aloud. */
export const WA_CODE_PATTERN = /\bBS[-\s]?([A-HJ-NP-Z2-9]{6})\b/i;
/** Button ids carry the CODE (semi-public), never the requestId. */
const BUTTON_ID_PATTERN = /^wa-login:(BS-[A-HJ-NP-Z2-9]{6}):(\d{2})$/;

/** Budgets (ADR-0038 §5, in ADR-0027's spirit). */
export const WA_START_CLIENT_HOURLY_MAX = 10;
export const WA_ATTACH_PHONE_HOURLY_MAX = 5;
const HOUR_SECONDS = 60 * 60;
/** After a confirm/deny the record lives this long for the browser to collect the answer. */
export const WA_DECIDED_TTL_SECONDS = 120;
/** Meta redelivers until it sees a 2xx; a message id is remembered this long. */
export const WA_MESSAGE_DEDUPE_SECONDS = 600;

const HOURLY_LUA = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n`;

/** pending → awaiting_confirm, once. ARGV: phone, profileName. */
const ATTACH_LUA = `
if redis.call('HGET', KEYS[1], 'status') ~= 'pending' then return 0 end
redis.call('HSET', KEYS[1], 'status', 'awaiting_confirm', 'phone', ARGV[1], 'profileName', ARGV[2])
return 1`;

/** awaiting_confirm → confirmed | denied, by the SAME phone, once. ARGV: phone, tapped, ttl. */
const DECIDE_LUA = `
if redis.call('HGET', KEYS[1], 'status') ~= 'awaiting_confirm' then return 'IGNORED' end
if redis.call('HGET', KEYS[1], 'phone') ~= ARGV[1] then return 'IGNORED' end
if redis.call('HGET', KEYS[1], 'match') == ARGV[2] then
  redis.call('HSET', KEYS[1], 'status', 'confirmed')
  redis.call('EXPIRE', KEYS[1], ARGV[3])
  return 'CONFIRMED'
end
redis.call('HSET', KEYS[1], 'status', 'denied', 'reason', 'WRONG_NUMBER')
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 'DENIED'`;

/** confirmed → consumed, once: the one status call that gets tokens. */
const CONSUME_LUA = `
if redis.call('HGET', KEYS[1], 'status') ~= 'confirmed' then return 0 end
redis.call('HSET', KEYS[1], 'status', 'consumed')
return 1`;

export type WaStartOutcome =
  | ({ result: 'STARTED' } & WaStartResponse)
  | { result: 'RATE_LIMITED' }
  | { result: 'DISABLED' };

/**
 * The "Tap to verify" state machine (FEAT-027, ADR-0038), entirely in Redis.
 *
 *   start (browser) ──► pending ──text with the code──► awaiting_confirm
 *        ──right button──► confirmed ──status──► consumed (tokens issued once)
 *        ──other button──► denied
 *   anything older than WA_LOGIN_TTL_SECONDS simply disappears (→ "expired").
 *
 * Two values, two trust levels: `requestId` never leaves the browser that started the
 * login and is the only key that collects tokens; the `code` rides in the WhatsApp message
 * and can only ATTACH a number. Nothing on the WhatsApp side differs for an administrator's
 * number (ADR-0023) — the role is looked up at token time only.
 */
@Injectable()
export class WaLoginService {
  private readonly logger = new Logger(WaLoginService.name);

  constructor(
    private readonly redis: RedisService,
    @Inject(WHATSAPP_SENDER) private readonly sender: WhatsAppSender,
    private readonly residents: ResidentsService,
    private readonly auth: AuthService,
  ) {}

  /** The sender decides (it was built from the environment — or, in tests, handed in). */
  get enabled(): boolean {
    return this.sender.mode !== 'off' && this.sender.businessNumber !== null;
  }

  private reqKey(requestId: string): string {
    return `wa:req:${requestId}`;
  }
  private codeKey(code: string): string {
    return `wa:code:${code}`;
  }

  /** A fresh request for one door. The society (resident door) is bound HERE, from the invite code. */
  async start(input: { door: WaDoor; societyId?: string; clientIp?: string; userAgent?: string }): Promise<WaStartOutcome> {
    const businessNumber = this.sender.businessNumber;
    if (!this.enabled || !businessNumber) return { result: 'DISABLED' };
    const starts = (await this.redis.eval(HOURLY_LUA, 1, `wa:start:${ipBucket(input.clientIp)}`, String(HOUR_SECONDS))) as number;
    if (starts > WA_START_CLIENT_HOURLY_MAX) return { result: 'RATE_LIMITED' };

    const requestId = randomBytes(32).toString('base64url');
    const code = await this.freshCode(requestId);
    const match = randomInt(10, 100);
    const options = shuffle([match, ...twoOthers(match)]);
    const expiresAt = new Date(Date.now() + WA_LOGIN_TTL_SECONDS * 1000).toISOString();
    await this.redis
      .multi()
      .hset(this.reqKey(requestId), {
        door: input.door,
        societyId: input.societyId ?? '',
        code,
        match: String(match),
        options: options.join(','),
        device: describeDevice(input.userAgent),
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
      .expire(this.reqKey(requestId), WA_LOGIN_TTL_SECONDS)
      .exec();
    const waLink = `https://wa.me/${businessNumber}?text=${encodeURIComponent(whatsAppLoginMessage(code))}`;
    return { result: 'STARTED', requestId, code, waLink, matchNumber: match, expiresAt };
  }

  /** A code nobody else holds right now: SET NX on its index, retried on the rare collision. */
  private async freshCode(requestId: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let body = '';
      for (let i = 0; i < WA_CODE_LENGTH; i += 1) body += WA_CODE_ALPHABET[randomInt(0, WA_CODE_ALPHABET.length)];
      const code = `BS-${body}`;
      const set = await this.redis.set(this.codeKey(code), requestId, 'EX', WA_LOGIN_TTL_SECONDS, 'NX');
      if (set !== null) return code;
    }
    throw new Error('Could not allocate a WhatsApp login code.');
  }

  /**
   * One inbound WhatsApp event — from the signed webhook, or from the dev simulator (the
   * same code path, so the simulator proves what the webhook will do).
   */
  async handleInbound(event: WaInboundEvent): Promise<void> {
    // Meta redelivers until it sees a 2xx; the second copy of a message must do nothing.
    const first = await this.redis.set(`wa:msg:${event.messageId}`, '1', 'EX', WA_MESSAGE_DEDUPE_SECONDS, 'NX');
    if (first === null) return;
    const phone = normalisePhone(`+${event.from}`);
    if (!phone) return;
    try {
      if (event.kind === 'text') await this.onText(phone, event.profileName, event.text);
      else await this.onButton(phone, event.buttonId);
    } catch (err) {
      // Let Meta redeliver (the controller answers 5xx): forget the message id first.
      await this.redis.del(`wa:msg:${event.messageId}`);
      throw err;
    }
  }

  private async onText(phone: string, profileName: string | null, text: string): Promise<void> {
    const found = WA_CODE_PATTERN.exec(text);
    if (!found) return; // free text: nothing to say that would not teach a prober something
    const code = `BS-${found[1].toUpperCase()}`;
    const requestId = await this.redis.get(this.codeKey(code));
    if (!requestId) return; // unknown or expired code: silence, identical for every caller
    // The attach budget (ADR-0038 §5): checked here, SPENT only by a real attach below — a
    // re-sent message to an already-attached request, or a redelivery, costs nothing (V2 P3).
    const attachKey = `wa:attach:${phone}`;
    if (Number((await this.redis.get(attachKey)) ?? '0') >= WA_ATTACH_PHONE_HOURLY_MAX) {
      this.logger.warn(`WhatsApp sign-in: ${redactPhone(phone)} exceeded the attach budget`);
      return;
    }
    const key = this.reqKey(requestId);
    const attached = (await this.redis.eval(ATTACH_LUA, 1, key, phone, profileName ?? '')) as number;
    if (attached !== 1) return; // already attached, decided or gone
    await this.redis.eval(HOURLY_LUA, 1, attachKey, String(HOUR_SECONDS));
    const [device, options] = await this.redis.hmget(key, 'device', 'options');
    const numbers = (options ?? '').split(',').filter(Boolean);
    try {
      await this.sender.sendButtons(
        phone,
        `Signing in to Bulk Saving on ${device ?? 'a browser'}.\n\nWhich number is on your screen? Only tap if that's you, right now.\n\nIf you didn't start this sign-in, ignore this message — nothing has happened.`,
        numbers.map((n) => ({ id: `wa-login:${code}:${n}`, title: n })),
      );
    } catch (err) {
      // Back to pending, so the person can send the message again once the API is well.
      await this.redis.hset(key, { status: 'pending', phone: '', profileName: '' });
      throw err;
    }
  }

  private async onButton(phone: string, buttonId: string): Promise<void> {
    const parsed = BUTTON_ID_PATTERN.exec(buttonId);
    if (!parsed) return;
    const [, code, tapped] = parsed;
    const requestId = await this.redis.get(this.codeKey(code));
    if (!requestId) return;
    const decided = (await this.redis.eval(DECIDE_LUA, 1, this.reqKey(requestId), phone, tapped, String(WA_DECIDED_TTL_SECONDS))) as string;
    if (decided === 'CONFIRMED') {
      await this.sender.sendText(phone, "That's it — you're signed in. Head back to Bulk Saving.");
    } else if (decided === 'DENIED') {
      await this.sender.sendText(
        phone,
        "That wasn't the number on the screen, so nothing happened. If you did start this sign-in, go back to Bulk Saving and start again.",
      );
    }
  }

  /** The browser's view. Tokens are issued exactly once, on the first call that finds `confirmed`. */
  async status(requestId: string): Promise<WaStatusResponse> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(requestId)) return { status: 'expired' };
    const key = this.reqKey(requestId);
    const record = await this.redis.hgetall(key);
    switch (record.status) {
      case 'pending':
      case 'awaiting_confirm':
        return { status: record.status };
      case 'denied':
        return { status: 'denied', reason: record.reason === 'NOT_AN_ADMIN' ? 'NOT_AN_ADMIN' : 'WRONG_NUMBER' };
      case 'confirmed':
        break;
      default:
        return { status: 'expired' }; // never existed, gone, or already consumed — one answer
    }
    // The database work comes BEFORE the consume (V2 P3): a Prisma hiccup here leaves the
    // confirmation in place for the next poll instead of losing it; only token issue follows
    // the consume, so tokens can still be minted once and once only.
    const phone = record.phone;
    let resident: Resident;
    if (record.door === 'admin') {
      // ADR-0023: the role is decided here and only here. The browser that started this
      // request is the only party that can see the answer, and it sees it only after the
      // number's owner tapped the right button — the OTP door's 403, one step later.
      const admin = await this.residents.findAdminByPhone(phone);
      if (!admin) {
        await this.redis.hset(key, { status: 'denied', reason: 'NOT_AN_ADMIN' });
        return { status: 'denied', reason: 'NOT_AN_ADMIN' };
      }
      resident = await this.residents.markVerified(admin);
    } else {
      // societyId was bound from the invite code at START (ADR-0003) — never from anything the
      // WhatsApp side said. The profile name is a default for a NEW resident only.
      resident = await this.residents.upsertVerifiedDefaultName(record.societyId, phone, record.profileName || null);
    }
    const consumed = (await this.redis.eval(CONSUME_LUA, 1, key)) as number;
    if (consumed !== 1) return { status: 'expired' };
    const tokens = await this.auth.issueTokens(resident);
    return { status: 'confirmed', ...tokens, resident: toResidentDto(resident) };
  }
}

/** Two distinct 2-digit decoys that are not the match. */
function twoOthers(match: number): [number, number] {
  const picks = new Set<number>([match]);
  while (picks.size < 3) picks.add(randomInt(10, 100));
  picks.delete(match);
  const [a, b] = [...picks];
  return [a, b];
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
