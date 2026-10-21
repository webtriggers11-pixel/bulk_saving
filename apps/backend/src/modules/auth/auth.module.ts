import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResidentsModule } from '../residents/residents.module';
import { ResidentsController } from '../residents/residents.controller';
import { SocietiesModule } from '../societies/societies.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AccessTokenGuard } from './access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpSendProcessor, OTP_SEND_QUEUE } from './otp-send.processor';
import { OtpService } from './otp.service';
import { RolesGuard } from './roles.guard';
import { WaLoginController } from './wa-login.controller';
import { WaLoginService } from './wa-login.service';
import { WaWebhookController } from './wa-webhook.controller';

/**
 * Phone-OTP + JWT auth (ADR-0007). Owns the OTP + token services, the guards,
 * and every authenticated read (auth flow, /me, tenant-scoped resident reads).
 * Secrets come from env config — never hardcoded.
 */
@Module({
  imports: [
    JwtModule.register({}),
    // CHORE-017: the admin door's OTP sends (ADR-0027).
    BullModule.registerQueue({ name: OTP_SEND_QUEUE }),
    NotificationsModule,
    SocietiesModule,
    ResidentsModule,
    // FEAT-027 (ADR-0038): the WhatsApp adapter; the sign-in state machine itself is here.
    WhatsAppModule,
  ],
  controllers: [AuthController, ResidentsController, WaLoginController, WaWebhookController],
  providers: [OtpService, OtpSendProcessor, AuthService, AccessTokenGuard, RolesGuard, WaLoginService],
  exports: [AuthService, AccessTokenGuard, RolesGuard, WaLoginService],
})
export class AuthModule {}
