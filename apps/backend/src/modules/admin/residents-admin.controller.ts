import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { AdminResidentDetailDto, AdminResidentDto, Page } from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth, type AuthContext } from '../auth/auth-context';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminResidentsQueryDto, UpdateResidentDto } from './residents-admin.dto';
import { ResidentsAdminService } from './residents-admin.service';

/** Users and access rights (FEAT-033, ADR-0044). SUPER_ADMIN only; a resident token gets 403. */
@Controller('admin/residents')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ResidentsAdminController {
  constructor(private readonly residents: ResidentsAdminService) {}

  @Get()
  list(@Query() query: AdminResidentsQueryDto): Promise<Page<AdminResidentDto>> {
    return this.residents.list(query);
  }

  /** FEAT-035: the user detail page — profile plus every pledge. */
  @Get(':id')
  detail(@Param('id') id: string): Promise<AdminResidentDetailDto> {
    return this.residents.detail(id);
  }

  @Patch(':id')
  update(@CurrentAuth() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateResidentDto): Promise<AdminResidentDto> {
    return this.residents.update(ctx.residentId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentAuth() ctx: AuthContext, @Param('id') id: string): Promise<{ deleted: true }> {
    return this.residents.remove(ctx.residentId, id);
  }
}
