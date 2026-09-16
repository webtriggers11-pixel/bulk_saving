import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { RoundDto } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth, type AuthContext } from '../auth/auth-context';
import { JoinRoundDto } from './rounds.dto';
import { RoundsService } from './rounds.service';

/**
 * Resident-facing rounds API (FEAT-003). Every route is tenant-scoped by the
 * verified auth context `societyId` (ADR-0003) — never from request input — so a
 * resident only ever sees or joins rounds in their own society; anything else
 * reads as 404.
 */
@Controller('rounds')
@UseGuards(AccessTokenGuard)
export class RoundsController {
  constructor(private readonly rounds: RoundsService) {}

  @Get()
  list(@CurrentAuth() ctx: AuthContext): Promise<RoundDto[]> {
    return this.rounds.listForSociety(ctx.societyId, ctx.residentId);
  }

  @Post(':id/join')
  join(
    @Param('id') id: string,
    @Body() dto: JoinRoundDto,
    @CurrentAuth() ctx: AuthContext,
  ): Promise<RoundDto> {
    return this.rounds.join(id, ctx.societyId, ctx.residentId, dto.units);
  }

  @Patch(':id/join')
  update(
    @Param('id') id: string,
    @Body() dto: JoinRoundDto,
    @CurrentAuth() ctx: AuthContext,
  ): Promise<RoundDto> {
    return this.rounds.updatePledge(id, ctx.societyId, ctx.residentId, dto.units);
  }

  @Delete(':id/join')
  leave(@Param('id') id: string, @CurrentAuth() ctx: AuthContext): Promise<RoundDto> {
    return this.rounds.leave(id, ctx.societyId, ctx.residentId);
  }
}
