import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { MyRoundDto, RatingDto, RoundDto } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth, type AuthContext } from '../auth/auth-context';
import { RatingsService } from './ratings.service';
import { JoinRoundDto, RateRoundDto } from './rounds.dto';
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
  constructor(
    private readonly rounds: RoundsService,
    private readonly ratings: RatingsService,
  ) {}

  @Get()
  list(@CurrentAuth() ctx: AuthContext): Promise<RoundDto[]> {
    return this.rounds.listForSociety(ctx.societyId, ctx.residentId);
  }

  /**
   * "My Requests" (FEAT-007): every round the caller has joined, any status, with
   * their own rating. Declared BEFORE `:id` routes would matter — `mine` is a
   * literal segment on its own path, so there is no ambiguity, but keeping it next
   * to `list` documents that this is the second resident feed.
   */
  @Get('mine')
  listMine(@CurrentAuth() ctx: AuthContext): Promise<MyRoundDto[]> {
    return this.rounds.listMine(ctx.societyId, ctx.residentId);
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

  /**
   * Rate a delivered round (FEAT-007, ADR-0017). Idempotent by design: PUT creates
   * or replaces the caller's own rating, so a resident can correct a mis-tap.
   */
  @Put(':id/rating')
  rate(
    @Param('id') id: string,
    @Body() dto: RateRoundDto,
    @CurrentAuth() ctx: AuthContext,
  ): Promise<RatingDto> {
    return this.ratings.rate(id, ctx.societyId, ctx.residentId, dto);
  }

  /** Withdraw the caller's own rating. The round stays RATED (status never rolls back). */
  @Delete(':id/rating')
  @HttpCode(HttpStatus.NO_CONTENT)
  unrate(@Param('id') id: string, @CurrentAuth() ctx: AuthContext): Promise<void> {
    return this.ratings.remove(id, ctx.societyId, ctx.residentId);
  }
}
