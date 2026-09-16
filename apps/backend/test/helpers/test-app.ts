import { randomBytes, randomInt } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/response.interceptor';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../../src/modules/notifications/notification-channel';

/** A notification channel that records the last OTP — the ONLY test hook for the code. */
export class CapturingChannel implements NotificationChannel {
  public lastCode: string | null = null;
  public lastPhone: string | null = null;
  public sends = 0;
  async sendOtp(phone: string, code: string): Promise<void> {
    this.sends += 1;
    this.lastPhone = phone;
    this.lastCode = code;
  }
  async send(): Promise<void> {}
}

/**
 * Boots the full Nest app (real DB + Redis) with the standard envelope wiring,
 * overriding the SMS channel with a capturing fake so tests can recover the OTP
 * WITHOUT it ever appearing in an API response.
 */
export async function createTestApp(channel: CapturingChannel): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(NOTIFICATION_CHANNEL)
    .useValue(channel)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  return app;
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
