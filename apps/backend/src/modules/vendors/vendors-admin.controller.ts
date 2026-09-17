import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { VendorDto } from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVendorDto, UpdateVendorDto } from './vendors.dto';
import { VendorsService } from './vendors.service';

/**
 * Super-admin vendor management (FEAT-005, ADR-0012). SUPER_ADMIN-only via the
 * shared access-token + roles guards; a resident token gets 403. POST returns 201,
 * GET and PATCH return 200.
 */
@Controller('admin/vendors')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class VendorsAdminController {
  constructor(private readonly vendors: VendorsService) {}

  @Get()
  list(): Promise<VendorDto[]> {
    return this.vendors.list();
  }

  @Post()
  create(@Body() dto: CreateVendorDto): Promise<VendorDto> {
    return this.vendors.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto): Promise<VendorDto> {
    return this.vendors.update(id, dto);
  }
}
