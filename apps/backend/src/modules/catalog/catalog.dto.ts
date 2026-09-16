import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import type {
  CreateServiceBody,
  UpdateServiceBody,
  UpsertOfferingBody,
} from '@bulk/shared';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `POST /admin/services` — create a master service. */
export class CreateServiceDto implements CreateServiceBody {
  @IsString()
  @Length(1, 120)
  name!: string;

  @Matches(SLUG, { message: 'slug must be lowercase alphanumeric words separated by hyphens.' })
  @Length(1, 120)
  slug!: string;

  @IsString()
  @Length(1, 2000)
  description!: string;

  @IsString()
  @Length(1, 80)
  category!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  imageUrl?: string;
}

/** `PATCH /admin/services/:id` — partial update / toggle active. */
export class UpdateServiceDto implements UpdateServiceBody {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @Matches(SLUG, { message: 'slug must be lowercase alphanumeric words separated by hyphens.' })
  @Length(1, 120)
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  category?: string;

  // Nullable: null clears the image. Validate as a string only when non-null.
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @Length(1, 2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** `PUT /admin/societies/:societyId/offerings/:serviceId` — upsert an offering. */
export class UpsertOfferingDto implements UpsertOfferingBody {
  @IsBoolean()
  enabled!: boolean;

  // Nullable: null clears the indicative price. Non-negative integer rupees.
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsInt()
  @Min(0)
  indicativePrice?: number | null;
}
