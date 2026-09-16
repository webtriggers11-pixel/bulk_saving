import { Module } from '@nestjs/common';
import { NOTIFICATION_CHANNEL } from './notification-channel';
import { StubSmsChannel } from './stub-sms.channel';

/**
 * Binds the active {@link NotificationChannel} implementation. v1 = stub SMS.
 * Swap the `useClass` here (or make it config-driven) when a real provider lands.
 */
@Module({
  providers: [{ provide: NOTIFICATION_CHANNEL, useClass: StubSmsChannel }],
  exports: [NOTIFICATION_CHANNEL],
})
export class NotificationsModule {}
