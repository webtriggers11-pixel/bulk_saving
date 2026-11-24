import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { ACTIVE_FILTERS, MAX_SEARCH, type ActiveFilter, type AdminSocietiesQuery } from '@bulk/shared';
import { PageQueryDto } from '../../common/pagination';
import { INDIAN_STATES, PINCODE_PATTERN, normalisePhone, type CreateSocietyBody, type UpdateSocietyBody } from '@bulk/shared';

/** Trim string inputs before validation so whitespace-only names fail the length check. */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** An optional text field: trimmed, and blank means "none" (null). */
const blankToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

/**
 * The contact phone (FEAT-043): blank → null; anything `normalisePhone` accepts → canonical
 * `+91…`; anything else is left as typed so the pattern check below refuses it with a 400.
 */
const toPhone = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (t === '') return null;
  return normalisePhone(t) ?? t;
};

/** A canonical Indian mobile. Other countries are refused: the platform is India-only (ADR-0042). */
export const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

const present = (_o: unknown, value: unknown) => value !== undefined;
const presentNotNull = (_o: unknown, value: unknown) => value !== undefined && value !== null;

/** `POST /admin/societies` (FEAT-032, ADR-0043; FEAT-043 address, ADR-0050). No invite code: the server generates it. */
export class CreateSocietyDto implements CreateSocietyBody {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 60)
  city!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'addressLine1 must be the building and street (3–120 characters)' })
  addressLine1!: string;

  @Transform(blankToNull)
  @ValidateIf(presentNotNull)
  @IsString()
  @Length(1, 120)
  addressLine2?: string | null;

  @Transform(blankToNull)
  @ValidateIf(presentNotNull)
  @IsString()
  @Length(1, 80)
  landmark?: string | null;

  @Transform(trim)
  @IsIn(INDIAN_STATES, { message: 'state must be an Indian state or union territory' })
  state!: string;

  @Transform(trim)
  @IsString()
  @Matches(PINCODE_PATTERN, { message: 'pincode must be 6 digits' })
  pincode!: string;

  @Transform(toPhone)
  @ValidateIf(presentNotNull)
  @IsString()
  @Matches(INDIAN_MOBILE, { message: 'contactPhone must be a 10-digit Indian mobile number' })
  contactPhone?: string | null;
}

/**
 * `PATCH /admin/societies/:id`: partial. Name, city, line 1, state and pincode may not be null
 * or blank; line 2, landmark and phone may be cleared with null or "".
 */
export class UpdateSocietyDto implements UpdateSocietyBody {
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name?: string;

  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  city?: string;

  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'addressLine1 must be the building and street (3–120 characters)' })
  addressLine1?: string;

  @Transform(blankToNull)
  @ValidateIf(presentNotNull)
  @IsString()
  @Length(1, 120)
  addressLine2?: string | null;

  @Transform(blankToNull)
  @ValidateIf(presentNotNull)
  @IsString()
  @Length(1, 80)
  landmark?: string | null;

  @ValidateIf(present)
  @Transform(trim)
  @IsIn(INDIAN_STATES, { message: 'state must be an Indian state or union territory' })
  state?: string;

  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @Matches(PINCODE_PATTERN, { message: 'pincode must be 6 digits' })
  pincode?: string;

  @Transform(toPhone)
  @ValidateIf(presentNotNull)
  @IsString()
  @Matches(INDIAN_MOBILE, { message: 'contactPhone must be a 10-digit Indian mobile number' })
  contactPhone?: string | null;

  /** FEAT-035 (ADR-0045 §4): false stops the invite code admitting anyone. */
  @ValidateIf(present)
  @IsBoolean()
  active?: boolean;
}

/** `GET /admin/societies` (FEAT-044): a page, optional search and active filter. */
export class AdminSocietiesQueryDto extends PageQueryDto implements AdminSocietiesQuery {
  @IsOptional()
  @IsString()
  @Length(0, MAX_SEARCH)
  q?: string;

  @IsOptional()
  @IsIn(ACTIVE_FILTERS, { message: `status must be one of: ${ACTIVE_FILTERS.join(', ')}.` })
  status?: ActiveFilter;
}
