import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminSocietyDto } from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SocietiesService } from '../societies/societies.service';

/**
 * Super-admin-only surface. `GET /admin/ping` demonstrates the role guard;
 * `GET /admin/societies` (FEAT-005) lists every society for the admin dashboard.
 */
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
export class AdminController {
  constructor(private readonly societies: SocietiesService) {}

  @Get('ping')
  @Roles(Role.SUPER_ADMIN)
  ping(): { pong: true } {
    return { pong: true };
  }

  @Get('societies')
  @Roles(Role.SUPER_ADMIN)
  listSocieties(): Promise<AdminSocietyDto[]> {
    return this.societies.listAll();
  }
}
