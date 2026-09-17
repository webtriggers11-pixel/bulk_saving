import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationDispatchProcessor } from './notification-dispatch.processor';
import { NotificationDispatchReconciler } from './notification-dispatch.reconciler';
import { NOTIFICATION_CHANNEL } from './notification-channel';
import { NOTIFICATIONS_QUEUE, NotificationsService } from './notifications.service';
import { StubSmsChannel } from './stub-sms.channel';

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
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  providers: [
    { provide: NOTIFICATION_CHANNEL, useClass: StubSmsChannel },
    NotificationsService,
    NotificationDispatchProcessor,
    NotificationDispatchReconciler,
  ],
  exports: [NOTIFICATION_CHANNEL, NotificationsService, NotificationDispatchReconciler],
})
export class NotificationsModule {}
