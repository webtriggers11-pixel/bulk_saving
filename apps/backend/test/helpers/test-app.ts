import { randomBytes, randomInt } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../../src/modules/notifications/notification-channel';
import { PUSH_SENDER, type PushSender, type PushTarget } from '../../src/modules/push/push-sender';

/**
 * A notification channel that records what was "delivered" — the ONLY test hook
 * for the code. `sends` / `lastCode` / `lastPhone` cover OTPs (FEAT-001);
 * `messages` records the FEAT-006 lifecycle sends, and `failSends` makes the
 * provider throw so the outbox's retry/FAILED path can be exercised.
 */
export class CapturingChannel implements NotificationChannel {
  public lastCode: string | null = null;
  public lastPhone: string | null = null;
  public sends = 0;
  public messages: Array<{ to: string; body: string }> = [];
  /** Every OTP sent, in order — so a test can wait for ITS phone's code (BUG-013). */
  public otps: Array<{ phone: string; code: string }> = [];
  public failSends = false;

  async sendOtp(phone: string, code: string): Promise<void> {
    this.sends += 1;
    this.lastPhone = phone;
    this.lastCode = code;
    this.otps.push({ phone, code });
  }

  async send(to: string, message: string): Promise<void> {
    if (this.failSends) {
      throw new Error('provider unavailable');
    }
    this.messages.push({ to, body: message });
  }

  /** Every lifecycle message delivered to one phone number. */
  messagesTo(phone: string): string[] {
    return this.messages.filter((m) => m.to === phone).map((m) => m.body);
  }
}

/**
 * Boots the full Nest app (real DB + Redis) with the standard envelope wiring,
 * overriding the SMS channel with a capturing fake so tests can recover the OTP
 * WITHOUT it ever appearing in an API response.
 */
export async function createTestApp(
  channel: CapturingChannel,
  pushSender: PushSender = new CapturingPushSender(),
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(NOTIFICATION_CHANNEL)
    .useValue(channel)
    .overrideProvider(PUSH_SENDER)
    .useValue(pushSender)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  // BUG-014 probe (test-only): an intermittent 404 on a route that exists has hit two
  // gate runs. Record the method, path and the body actually sent, so the next one
  // arrives with evidence instead of a bare status.
  app.use((req: { method: string; originalUrl: string }, res: { statusCode: number; on: (e: string, f: () => void) => void }, next: () => void) => {
    res.on('finish', () => {
      if (res.statusCode === 404) {
        process.stderr.write(`[BUG-014 probe] 404 for ${req.method} ${req.originalUrl}\n`);
      }
    });
    next();
  });
  await app.init();
  return app;
}

/**
 * FEAT-020: a push sender that records what it would have sent. Enabled, so the push
 * pipeline runs end to end; `failWith` makes the next sends throw (e.g. a PushGoneError).
 */
export class CapturingPushSender implements PushSender {
  readonly enabled = true;
  readonly publicKey = 'BTestVapidPublicKey';
  public sent: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  public failWith: Error | null = null;

  async send(target: PushTarget, payload: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload) });
  }

  to(endpoint: string): Array<Record<string, unknown>> {
    return this.sent.filter((s) => s.endpoint === endpoint).map((s) => s.payload);
  }
}

/** Random 8-char uppercase alphanumeric invite code (matches the spec format). */
export function randomInviteCode(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Random E.164-ish phone (digits only) unique per test run. */
export function randomPhone(): string {
  const digits = randomInt(0, 100_000_000).toString().padStart(8, '0');
  return `+9198${digits}`;
}
