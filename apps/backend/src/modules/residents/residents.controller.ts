import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import type { ResidentDto } from '@bulk/shared';
import { ErrorCode } from '../../common/error-codes';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth, type AuthContext } from '../auth/auth-context';
import { toResidentDto } from './residents.mapper';
import { ResidentsService } from './residents.service';

/**
 * Minimal authenticated resident read. Every lookup is scoped to the caller's
 * own society (ADR-0003): a resident id belonging to another society reads as
 * "not found", proving cross-tenant isolation.
 */
@Controller('residents')
@UseGuards(AccessTokenGuard)
export class ResidentsController {
  constructor(private readonly residents: ResidentsService) {}

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentAuth() ctx: AuthContext): Promise<ResidentDto> {
    const resident = await this.residents.findInSociety(id, ctx.societyId);
    if (!resident) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Resident not found.' });
    }
    return toResidentDto(resident);
  }
}
