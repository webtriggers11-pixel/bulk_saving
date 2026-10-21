import { Module } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { StubWhatsAppSender } from './stub-whatsapp.sender';
import { CloudApiWhatsAppSender, WHATSAPP_SENDER, type WhatsAppSender } from './whatsapp-sender';
import { whatsAppCloudConfig, whatsAppLoginMode } from './whatsapp.config';

/** Builds the sender for the current environment. A function, so the choice is unit-testable. */
export function buildWhatsAppSender(redis: RedisService, env: NodeJS.ProcessEnv = process.env): WhatsAppSender {
  const cloud = whatsAppCloudConfig(env);
  if (cloud) return new CloudApiWhatsAppSender(cloud);
  // No Meta app: the stub, which records in 'stub' mode and refuses in 'off'.
  return new StubWhatsAppSender(redis, whatsAppLoginMode(env) === 'stub' ? 'stub' : 'off');
}

/**
 * The WhatsApp adapter (FEAT-027, ADR-0038). Only the sender lives here — the login state
 * machine is auth's, and the webhook is registered there, because it needs the auth services
 * and AuthModule → WhatsAppModule must stay one-directional.
 */
@Module({
  providers: [{ provide: WHATSAPP_SENDER, useFactory: (redis: RedisService) => buildWhatsAppSender(redis), inject: [RedisService] }],
  exports: [WHATSAPP_SENDER],
})
export class WhatsAppModule {}
