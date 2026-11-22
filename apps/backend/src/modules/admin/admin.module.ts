import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocietiesModule } from '../societies/societies.module';
import { AdminController } from './admin.controller';
import { ResidentsAdminController } from './residents-admin.controller';
import { ResidentsAdminService } from './residents-admin.service';

@Module({
  imports: [AuthModule, SocietiesModule],
  controllers: [AdminController, ResidentsAdminController],
  providers: [ResidentsAdminService],
})
export class AdminModule {}
