import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminDashboardDto } from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RoundsAdminService } from './rounds-admin.service';

/**
 * `GET /admin/dashboard` (FEAT-005): status counts, demand per society and payment
 * totals across every society. SUPER_ADMIN-only; a resident token gets 403. Lives
 * in the rounds module because every aggregate is a read over rounds.
 */
@Controller('admin/dashboard')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminDashboardController {
  constructor(private readonly admin: RoundsAdminService) {}

  @Get()
  get(): Promise<AdminDashboardDto> {
    return this.admin.getDashboard();
  }
}
