import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AdminDashboardDto, AdminSocietyDemand, Page } from '@bulk/shared';
import { PageQueryDto } from '../../common/pagination';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RoundsAdminService } from './rounds-admin.service';

/**
 * `GET /admin/dashboard` (FEAT-005): status counts and payment totals across every society;
 * FEAT-044: demand per society is paged at `GET /admin/dashboard/demand`. SUPER_ADMIN-only; a resident token gets 403. Lives
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

  /** FEAT-044: demand per society, by name, a page at a time. */
  @Get('demand')
  demand(@Query() query: PageQueryDto): Promise<Page<AdminSocietyDemand>> {
    return this.admin.demandBySociety(query);
  }
}
