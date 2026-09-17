import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type {
  AdminRoundDetailDto,
  AdminRoundParticipantDto,
  AdminRoundSummaryDto,
  RoundDto,
} from '@bulk/shared';
import { Role } from '@bulk/shared';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentAuth, type AuthContext } from '../auth/auth-context';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminRoundsQueryDto, AssignRoundDto, CreateRoundDto, SetPaymentDto } from './rounds.dto';
import { RoundsAdminService } from './rounds-admin.service';

/**
 * Super-admin round management (FEAT-003). SUPER_ADMIN-only via the reused
 * FEAT-001 access-token + roles guards; a resident token gets 403. Opening a
 * round takes an explicit `societyId` in the body (an admin acts across
 * societies) — this is the authorised cross-tenant path, distinct from the
 * resident routes which derive scope from the JWT.
 *
 * FEAT-005 adds the cross-society list/detail reads and the assign / deliver /
 * payment actions. Every action POST (open, close, cancel, assign, deliver) keeps
 * Nest's default 201 for consistency; GET and the payment PUT return 200.
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

  @Get()
  list(@Query() query: AdminRoundsQueryDto): Promise<AdminRoundSummaryDto[]> {
    return this.admin.listRounds(query);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<AdminRoundDetailDto> {
    return this.admin.getRoundDetail(id);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @CurrentAuth() ctx: AuthContext): Promise<RoundDto> {
    return this.admin.close(id, ctx.residentId);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentAuth() ctx: AuthContext): Promise<RoundDto> {
    return this.admin.cancel(id, ctx.residentId);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignRoundDto): Promise<AdminRoundDetailDto> {
    return this.admin.assign(id, dto.vendorId, dto.finalPrice);
  }

  @Post(':id/deliver')
  deliver(@Param('id') id: string): Promise<AdminRoundDetailDto> {
    return this.admin.deliver(id);
  }

  @Put(':roundId/participants/:participantId/payment')
  setPayment(
    @Param('roundId') roundId: string,
    @Param('participantId') participantId: string,
    @Body() dto: SetPaymentDto,
  ): Promise<AdminRoundParticipantDto> {
    return this.admin.setPayment(roundId, participantId, dto.collected);
  }
}
