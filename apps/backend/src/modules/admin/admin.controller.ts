import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

/** Super-admin-only surface. `GET /admin/ping` demonstrates the role guard. */
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
export class AdminController {
  @Get('ping')
  @Roles(Role.SUPER_ADMIN)
  ping(): { pong: true } {
    return { pong: true };
  }
}
