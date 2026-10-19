import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { devToolsImports } from './modules/dev/dev-tools.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ResidentsModule } from './modules/residents/residents.module';
import { RoundsModule } from './modules/rounds/rounds.module';
import { PushApiModule } from './modules/push/push-api.module';
import { SocietiesModule } from './modules/societies/societies.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    /**
     * Global request ceiling (CHORE-007, ADR-0020). Defence in depth ONLY — the auth
     * routes keep their own, much tighter Redis limits (1 OTP / 30s, 5 / hour), which
     * this does not replace. The number is a guess without production traffic and is
     * flagged for revisit in ADR-0020; it is set high enough that a resident polling
     * the rounds list every 20s cannot trip it.
     */
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      },
      // CHORE-017: a key namespace for every queue. The test suite pins its own
      // (test/load-env.ts), because a dev server running against the same Redis was
      // consuming the suite's jobs — sending its OTPs through the dev stub, so the
      // test's channel never saw them. Unset in dev and production: BullMQ's `bull`.
      ...(process.env.BULLMQ_PREFIX ? { prefix: process.env.BULLMQ_PREFIX } : {}),
    }),
    PrismaModule,
    RedisModule,
    // FEAT-026 (ADR-0037): developer routes exist only where the dev OTP echo is on.
    ...devToolsImports(),
    HealthModule,
    QueueModule,
    NotificationsModule,
    SocietiesModule,
    ResidentsModule,
    AuthModule,
    AdminModule,
    CatalogModule,
    VendorsModule,
    RoundsModule,
    PushApiModule,
  ],
})
export class AppModule {}
