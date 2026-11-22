import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length, ValidateIf } from 'class-validator';
import type { CreateSocietyBody, UpdateSocietyBody } from '@bulk/shared';

/** Trim string inputs before validation so whitespace-only names fail the length check. */
const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** `POST /admin/societies` (FEAT-032, ADR-0043). No invite code: the server generates it. */
export class CreateSocietyDto implements CreateSocietyBody {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 60)
  city!: string;
}

/** `PATCH /admin/societies/:id`: partial; neither field may be null or blank. */
export class UpdateSocietyDto implements UpdateSocietyBody {
  @ValidateIf((_o, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  name?: string;

  @ValidateIf((_o, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  city?: string;

  /** FEAT-035 (ADR-0045 §4): false stops the invite code admitting anyone. */
  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
