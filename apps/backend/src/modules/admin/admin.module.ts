import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocietiesModule } from '../societies/societies.module';
import { AdminController } from './admin.controller';
import { ResidentsAdminController } from './residents-admin.controller';
import { ResidentsAdminService } from './residents-admin.service';
import { OverviewService } from './overview.service';

@Module({
  imports: [AuthModule, SocietiesModule],
  controllers: [AdminController, ResidentsAdminController],
  providers: [ResidentsAdminService, OverviewService],
})
export class AdminModule {}
