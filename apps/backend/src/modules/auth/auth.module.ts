import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResidentsModule } from '../residents/residents.module';
import { ResidentsController } from '../residents/residents.controller';
import { SocietiesModule } from '../societies/societies.module';
import { AccessTokenGuard } from './access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpSendProcessor, OTP_SEND_QUEUE } from './otp-send.processor';
import { OtpService } from './otp.service';
import { RolesGuard } from './roles.guard';

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
  ],
  controllers: [AuthController, ResidentsController],
  providers: [OtpService, OtpSendProcessor, AuthService, AccessTokenGuard, RolesGuard],
  exports: [AuthService, AccessTokenGuard, RolesGuard],
})
export class AuthModule {}
