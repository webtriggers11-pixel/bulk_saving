import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VendorsAdminController } from './vendors-admin.controller';
import { VendorsService } from './vendors.service';

/**
 * Vendors (FEAT-005, ADR-0012): the global, admin-managed vendor list. Exports
 * {@link VendorsService} so the rounds state machine can validate a vendor on assign.
 */
@Module({
  imports: [AuthModule],
  controllers: [VendorsAdminController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
