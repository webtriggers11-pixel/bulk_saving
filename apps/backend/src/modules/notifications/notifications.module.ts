import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationDispatchProcessor } from './notification-dispatch.processor';
import { NotificationDispatchReconciler } from './notification-dispatch.reconciler';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from './notification-channel';
import { NOTIFICATIONS_QUEUE, NotificationsService } from './notifications.service';
import { StubSmsChannel } from './stub-sms.channel';
import { TextbeeSmsChannel } from './textbee-sms.channel';
import { textbeeConfig } from './textbee.config';
import { RedisService } from '../../redis/redis.service';
import { PushModule } from '../push/push.module';

/**
 * Binds the active {@link NotificationChannel} implementation (v1 = stub SMS;
 * swap the `useClass` here, or make it config-driven, when a real provider lands)
 * and owns the FEAT-006 outbox: the `notifications` queue, the send processor and
 * the boot dispatch reconciler (ADR-0013).
 *
 * The outbox is domain-agnostic — round-specific rendering and fan-out live in
 * the rounds domain, which imports this module.
 */
@Module({
  // FEAT-020: dispatching a notification also fans it out to the resident's push devices.
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }), PushModule],
  providers: [
    // FEAT-046 (ADR-0054): TextBee when TEXTBEE_API_KEY + TEXTBEE_DEVICE_ID are set, else the stub.
    {
      provide: NOTIFICATION_CHANNEL,
      inject: [RedisService],
      useFactory: (redis: RedisService): NotificationChannel => {
        const config = textbeeConfig();
        return config ? new TextbeeSmsChannel(config, redis) : new StubSmsChannel(redis);
      },
    },
    NotificationsService,
    NotificationDispatchProcessor,
    NotificationDispatchReconciler,
  ],
  exports: [NOTIFICATION_CHANNEL, NotificationsService, NotificationDispatchReconciler],
})
export class NotificationsModule {}
