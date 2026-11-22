import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { AdminOverviewDto, AdminSocietyDetailDto } from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateSocietyDto, UpdateSocietyDto } from '../societies/societies.dto';
import { SocietiesService } from '../societies/societies.service';
import { OverviewService } from './overview.service';

/**
 * Super-admin-only surface. `GET /admin/ping` demonstrates the role guard;
 * `/admin/societies` lists (FEAT-005) and manages (FEAT-032, ADR-0043) every society.
 */
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly societies: SocietiesService,
    private readonly overview: OverviewService,
  ) {}

  /** FEAT-034: platform counts and the newest societies and users, for the dashboard. */
  @Get('overview')
  getOverview(): Promise<AdminOverviewDto> {
    return this.overview.get();
  }

  @Get('ping')
  ping(): { pong: true } {
    return { pong: true };
  }

  @Get('societies')
  listSocieties(): Promise<AdminSocietyDetailDto[]> {
    return this.societies.listAll();
  }

  @Get('societies/:id')
  getSociety(@Param('id') id: string): Promise<AdminSocietyDetailDto> {
    return this.societies.getDetail(id);
  }

  @Post('societies')
  createSociety(@Body() dto: CreateSocietyDto): Promise<AdminSocietyDetailDto> {
    return this.societies.create(dto);
  }

  @Patch('societies/:id')
  updateSociety(@Param('id') id: string, @Body() dto: UpdateSocietyDto): Promise<AdminSocietyDetailDto> {
    return this.societies.update(id, dto);
  }

  /** A fresh invite code; the old one stops working at once (ADR-0043 §2). */
  @Post('societies/:id/invite-code')
  @HttpCode(HttpStatus.OK)
  rotateInviteCode(@Param('id') id: string): Promise<AdminSocietyDetailDto> {
    return this.societies.rotateInviteCode(id);
  }

  /** Only an empty society (no residents, no rounds) — otherwise 409 (ADR-0043 §3). */
  @Delete('societies/:id')
  deleteSociety(@Param('id') id: string): Promise<{ deleted: true }> {
    return this.societies.remove(id);
  }
}
