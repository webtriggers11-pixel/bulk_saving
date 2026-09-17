import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  AdminRoundsQuery,
  AssignRoundBody,
  CreateRoundBody,
  JoinRoundBody,
  RoundTierDto,
  SetPaymentBody,
} from '@bulk/shared';
import { RoundStatus } from '@bulk/shared';

/**
 * One tier in a `POST /admin/rounds` payload. Per-field validation only
 * (threshold >= 1, price >= 1); cross-field rules — non-empty, strictly
 * ascending thresholds — live in the service where the whole set is visible.
 */
export class RoundTierInputDto implements RoundTierDto {
  @IsInt()
  @Min(1)
  threshold!: number;

  @IsInt()
  @Min(1)
  price!: number;
}

/** `POST /admin/rounds` — open a round for a (society, service) with tiers. */
export class CreateRoundDto implements CreateRoundBody {
  @IsString()
  societyId!: string;

  @IsString()
  serviceId!: string;

  @IsISO8601()
  deadline!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RoundTierInputDto)
  tiers!: RoundTierInputDto[];
}

/** Max units one resident may pledge in a single round (v1 guard, FEAT-003). */
export const MAX_UNITS_PER_RESIDENT = 50;

/**
 * `POST`/`PATCH /rounds/:id/join` — pledge (or change) a number of units. The
 * `@Max` is a sane v1 upper bound so a single resident cannot pledge absurd
 * amounts and swing the tier price for everyone.
 */
export class JoinRoundDto implements JoinRoundBody {
  @IsInt()
  @Min(1)
  @Max(MAX_UNITS_PER_RESIDENT)
  units!: number;
}

/** `GET /admin/rounds` query (FEAT-005): optional status + society filters. */
export class AdminRoundsQueryDto implements AdminRoundsQuery {
  @IsOptional()
  @IsIn(Object.values(RoundStatus))
  status?: RoundStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  societyId?: string;
}

/** Upper bound on a negotiated per-unit final price (integer rupees). */
export const MAX_FINAL_PRICE = 1_000_000;

/** `POST /admin/rounds/:id/assign` (FEAT-005): vendor + negotiated per-unit price. */
export class AssignRoundDto implements AssignRoundBody {
  @IsString()
  @IsNotEmpty()
  vendorId!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_FINAL_PRICE)
  finalPrice!: number;
}

/** `PUT /admin/rounds/:roundId/participants/:participantId/payment` (FEAT-005). */
export class SetPaymentDto implements SetPaymentBody {
  @IsBoolean()
  collected!: boolean;
}
