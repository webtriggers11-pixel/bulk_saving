import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PushSendProcessor } from './push-send.processor';
import { PUSH_SENDER, WebPushSender } from './push-sender';
import { PUSH_QUEUE, PushService } from './push.service';

/**
 * Web push core (FEAT-020, ADR-0032): subscriptions, the per-device `push-send` queue and
 * its worker. No HTTP here — the routes live in {@link PushApiModule}, because they need
 * AuthModule, and AuthModule → NotificationsModule → PushModule would make a cycle. The notification outbox (ADR-0013) calls {@link PushService.fanOut} when it
 * dispatches a message, so push rides the same transactional, deduplicated pipeline as SMS.
 */
@Module({
  imports: [BullModule.registerQueue({ name: PUSH_QUEUE })],
  providers: [{ provide: PUSH_SENDER, useClass: WebPushSender }, PushService, PushSendProcessor],
  exports: [PushService, PUSH_SENDER],
})
export class PushModule {}
