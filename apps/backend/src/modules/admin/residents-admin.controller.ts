import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminResidentDetailDto, AdminResidentDto, AdminResidentPledgeDto, Page } from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth, type AuthContext } from '../auth/auth-context';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PageQueryDto } from '../../common/pagination';
import { AdminResidentsQueryDto, CreateAdminDto, UpdateResidentDto } from './residents-admin.dto';
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

  /** FEAT-035: the user detail page — profile plus pledge counts. */
  @Get(':id')
  detail(@Param('id') id: string): Promise<AdminResidentDetailDto> {
    return this.residents.detail(id);
  }

  /** FEAT-044: the user's pledges, newest first, a page at a time. */
  @Get(':id/pledges')
  pledges(@Param('id') id: string, @Query() query: PageQueryDto): Promise<Page<AdminResidentPledgeDto>> {
    return this.residents.pledges(id, query);
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

/** FEAT-036 (ADR-0046): platform admins, who belong to no society. SUPER_ADMIN only. */
@Controller('admin/admins')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class PlatformAdminsController {
  constructor(private readonly residents: ResidentsAdminService) {}

  @Post()
  create(@Body() dto: CreateAdminDto): Promise<AdminResidentDto> {
    return this.residents.createAdmin(dto);
  }
}
