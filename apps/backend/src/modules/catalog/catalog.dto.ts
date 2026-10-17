import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SearchCategoryStatusQuery } from '../../common/list-filters';
import {
  MAX_INDICATIVE_PRICE,
  MAX_UNIT_DESCRIPTION,
  MAX_UNIT_LABEL,
  SERVICE_CATEGORIES,
  MAX_SEARCH,
  type AdminServicesQuery,
  type CatalogQuery,
  type CreateServiceBody,
  type ServiceCategory,
  type UpdateServiceBody,
  type UpsertOfferingBody,
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

  // FEAT-014 (ADR-0025): a closed list, so a typo cannot become a catalog section.
  @IsIn(SERVICE_CATEGORIES, { message: `category must be one of: ${SERVICE_CATEGORIES.join(', ')}.` })
  category!: ServiceCategory;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  imageUrl?: string;

  // FEAT-010 (ADR-0019): what one unit of this service IS. Optional — omitting them
  // yields the column defaults (unit/units), i.e. the pre-FEAT-010 wording. Trimmed
  // before the length check so a trailing space cannot fail a 24-char label.
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, MAX_UNIT_LABEL)
  unitLabel?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, MAX_UNIT_LABEL)
  unitLabelPlural?: string;

  /** The scope sentence — what one unit includes. This is what settles disputes. */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, MAX_UNIT_DESCRIPTION)
  unitDescription?: string;
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
  @IsIn(SERVICE_CATEGORIES, { message: `category must be one of: ${SERVICE_CATEGORIES.join(', ')}.` })
  category?: ServiceCategory;

  // Nullable: null clears the image. Validate as a string only when non-null.
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @Length(1, 2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // FEAT-010 unit fields. Same rules as create; `unitDescription` is nullable here
  // so an admin can clear a scope sentence that no longer applies.
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, MAX_UNIT_LABEL)
  unitLabel?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, MAX_UNIT_LABEL)
  unitLabelPlural?: string;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, MAX_UNIT_DESCRIPTION)
  unitDescription?: string | null;
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
  @Max(MAX_INDICATIVE_PRICE)
  indicativePrice?: number | null;
}

/** `GET /admin/services` query (FEAT-015, ADR-0026). */
export class AdminServicesQueryDto extends SearchCategoryStatusQuery implements AdminServicesQuery {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  offeredIn?: string;
}

/** `GET /catalog` query (FEAT-015). Society scope still comes only from the token. */
export class CatalogQueryDto implements CatalogQuery {
  @IsOptional()
  @IsString()
  @Length(0, MAX_SEARCH)
  q?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  category?: string;
}
