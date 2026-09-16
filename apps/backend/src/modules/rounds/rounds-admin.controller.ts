import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { RoundDto } from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth, type AuthContext } from '../auth/auth-context';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateRoundDto } from './rounds.dto';
import { RoundsAdminService } from './rounds-admin.service';

/**
 * Super-admin round management (FEAT-003). SUPER_ADMIN-only via the reused
 * FEAT-001 access-token + roles guards; a resident token gets 403. Opening a
 * round takes an explicit `societyId` in the body (an admin acts across
 * societies) — this is the authorised cross-tenant path, distinct from the
 * resident routes which derive scope from the JWT.
 */
@Controller('admin/rounds')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class RoundsAdminController {
  constructor(private readonly admin: RoundsAdminService) {}

  @Post()
  create(@Body() dto: CreateRoundDto, @CurrentAuth() ctx: AuthContext): Promise<RoundDto> {
    return this.admin.createRound(dto, ctx.residentId);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @CurrentAuth() ctx: AuthContext): Promise<RoundDto> {
    return this.admin.close(id, ctx.residentId);
  }
}
