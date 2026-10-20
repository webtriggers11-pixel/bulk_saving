import { Module, type Type } from '@nestjs/common';
import { devOtpEchoEnabled } from '../auth/otp.service';
import { DevOtpController } from './dev-otp.controller';

/**
 * Developer-only routes (FEAT-026, ADR-0037). Imported by AppModule ONLY when the dev OTP
 * echo is on (`OTP_DEV_LOG=true` and NODE_ENV explicitly development/test), so in every other environment nothing
 * here is even registered — the route is a 404 like any unknown path. RedisService comes
 * from the global RedisModule.
 */
@Module({ controllers: [DevOtpController] })
export class DevToolsModule {}

/**
 * What AppModule imports for developer tools: the module, or nothing. A function (with the
 * environment injectable) so the decision is unit-testable — the decorator metadata is
 * computed once at import time, which is why an integration test cannot flip it.
 */
export function devToolsImports(env: NodeJS.ProcessEnv = process.env): Type<unknown>[] {
  return devOtpEchoEnabled(env) ? [DevToolsModule] : [];
}
