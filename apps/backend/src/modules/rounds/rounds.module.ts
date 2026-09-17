import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VendorsModule } from '../vendors/vendors.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { RoundCloserProcessor } from './round-closer.processor';
import { RoundClosingReconciler } from './round-closing.reconciler';
import { RoundClosingScheduler, ROUND_CLOSING_QUEUE } from './round-closing.scheduler';
import { RoundsAdminController } from './rounds-admin.controller';
import { RoundsAdminService } from './rounds-admin.service';
import { RoundsController } from './rounds.controller';
import { RoundsService } from './rounds.service';

/**
 * Rounds domain (FEAT-003 + FEAT-004, ADR-0010/0011): resident-facing view +
 * join/update/leave and the super-admin open/close/cancel API, plus the BullMQ
 * `round-closing` queue that drives the deadline-close state machine. FEAT-005 adds
 * the admin dashboard, cross-society reads and assign / deliver / payment actions
 * (VendorsModule supplies vendor validation on assign). Imports
 * AuthModule for the shared access-token + roles guards. `RoundsService` owns all
 * count + status mutations; `RoundCloserProcessor` only delegates to it.
 */
@Module({
  imports: [AuthModule, VendorsModule, BullModule.registerQueue({ name: ROUND_CLOSING_QUEUE })],
  controllers: [RoundsController, RoundsAdminController, AdminDashboardController],
  providers: [
    RoundsService,
    RoundsAdminService,
    RoundClosingScheduler,
    RoundCloserProcessor,
    RoundClosingReconciler,
  ],
  exports: [RoundsService, RoundsAdminService],
})
export class RoundsModule {}
