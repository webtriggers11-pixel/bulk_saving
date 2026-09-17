import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocietiesModule } from '../societies/societies.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule, SocietiesModule],
  controllers: [AdminController],
})
export class AdminModule {}
