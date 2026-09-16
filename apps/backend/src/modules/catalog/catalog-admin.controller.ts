import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AdminServiceDto, ServiceOfferingDto } from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CatalogAdminService } from './catalog-admin.service';
import { CreateServiceDto, UpdateServiceDto, UpsertOfferingDto } from './catalog.dto';

/**
 * Super-admin catalog management API (FEAT-002). Every route is SUPER_ADMIN-only
 * via the reused FEAT-001 access-token + roles guards; a resident token gets 403.
 * The management UI is FEAT-005 — v1 ships the API + seed only.
 */
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class CatalogAdminController {
  constructor(private readonly admin: CatalogAdminService) {}

  @Post('services')
  createService(@Body() dto: CreateServiceDto): Promise<AdminServiceDto> {
    return this.admin.createService(dto);
  }

  @Get('services')
  listServices(): Promise<AdminServiceDto[]> {
    return this.admin.listServices();
  }

  @Patch('services/:id')
  updateService(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<AdminServiceDto> {
    return this.admin.updateService(id, dto);
  }

  @Put('societies/:societyId/offerings/:serviceId')
  upsertOffering(
    @Param('societyId') societyId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpsertOfferingDto,
  ): Promise<ServiceOfferingDto> {
    return this.admin.upsertOffering(societyId, serviceId, dto);
  }
}
