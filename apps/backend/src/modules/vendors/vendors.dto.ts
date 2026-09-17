import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { CreateVendorBody, UpdateVendorBody } from '@bulk/shared';

/** Vendor phone: optional leading `+`, then 8–15 digits. */
const VENDOR_PHONE = /^\+?[0-9]{8,15}$/;

/** Trim string inputs before validation so whitespace-only names fail the length check. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** `POST /admin/vendors`: add a vendor to the global list (FEAT-005, ADR-0012). */
export class CreateVendorDto implements CreateVendorBody {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @Transform(trim)
  @IsString()
  @Matches(VENDOR_PHONE, { message: 'phone must be 8–15 digits with an optional leading +.' })
  phone!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** `PATCH /admin/vendors/:id`: partial update; null clears `category` / `notes`. */
export class UpdateVendorDto implements UpdateVendorBody {
  // Non-nullable fields: skip validation only when ABSENT. `@IsOptional()` would
  // also skip null, which then reached Prisma and surfaced as a 500.
  @ValidateIf((_o, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @ValidateIf((_o, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Matches(VENDOR_PHONE, { message: 'phone must be 8–15 digits with an optional leading +.' })
  phone?: string;

  // Nullable: null clears the category. Validate as a string only when non-null.
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  category?: string | null;

  // Nullable: null clears the notes.
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
