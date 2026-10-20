import { Module, type Type } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { devOtpEchoEnabled } from '../auth/otp.service';
import { DevOtpController } from './dev-otp.controller';
import { DevWhatsAppController } from './dev-whatsapp.controller';

/**
 * Developer-only routes (FEAT-026, ADR-0037; FEAT-027's WhatsApp simulator). Imported by
 * AppModule ONLY when the dev OTP echo is on (`OTP_DEV_LOG=true` and NODE_ENV explicitly
 * development/test), so in every other environment nothing here is even registered — the
 * routes are 404s like any unknown path. RedisService comes from the global RedisModule;
 * the WhatsApp login service from AuthModule.
 */
@Module({ imports: [AuthModule], controllers: [DevOtpController, DevWhatsAppController] })
export class DevToolsModule {}

/**
 * What AppModule imports for developer tools: the module, or nothing. A function (with the
 * environment injectable) so the decision is unit-testable — the decorator metadata is
 * computed once at import time, which is why an integration test cannot flip it.
 */
export function devToolsImports(env: NodeJS.ProcessEnv = process.env): Type<unknown>[] {
  return devOtpEchoEnabled(env) ? [DevToolsModule] : [];
}
