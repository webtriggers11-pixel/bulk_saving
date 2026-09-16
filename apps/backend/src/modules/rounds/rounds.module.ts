import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoundsAdminController } from './rounds-admin.controller';
import { RoundsAdminService } from './rounds-admin.service';
import { RoundsController } from './rounds.controller';
import { RoundsService } from './rounds.service';

/**
 * Rounds domain (FEAT-003, ADR-0010): resident-facing view + join/update/leave
 * and the super-admin open/close API. Imports AuthModule for the shared
 * access-token + roles guards. `RoundsService` owns all count + status mutations.
 */
@Module({
  imports: [AuthModule],
  controllers: [RoundsController, RoundsAdminController],
  providers: [RoundsService, RoundsAdminService],
  exports: [RoundsService, RoundsAdminService],
})
export class RoundsModule {}
