import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ACTIVE_FILTERS, MAX_SEARCH, type ActiveFilter } from '@bulk/shared';

/**
 * Shared pieces of the FEAT-015 list filters (ADR-0026).
 *
 * The global ValidationPipe validates but does not transform, so a handler receives the
 * raw query string — a DTO-level trim would be checked and then thrown away. Search is
 * therefore normalised here, in the service layer, where it is actually used.
 */

/** The trimmed search term, or undefined when there is nothing to search for. */
export function searchTerm(q: string | undefined): string | undefined {
  const trimmed = q?.trim();
  return trimmed ? trimmed : undefined;
}

/** A Prisma case-insensitive substring match (`ILIKE '%term%'` on Postgres). */
export function containsInsensitive(term: string): { contains: string; mode: 'insensitive' } {
  return { contains: term, mode: 'insensitive' };
}

/** `status=active|inactive` → the `active` column value, or undefined for "both". */
export function activeFrom(status: ActiveFilter | undefined): boolean | undefined {
  return status === undefined ? undefined : status === 'active';
}

/** `q`, `category`, `status` — the three filters services and vendors share. */
export class SearchCategoryStatusQuery {
  @IsOptional()
  @IsString()
  @Length(0, MAX_SEARCH)
  q?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  category?: string;

  @IsOptional()
  @IsIn(ACTIVE_FILTERS, { message: `status must be one of: ${ACTIVE_FILTERS.join(', ')}.` })
  status?: ActiveFilter;
}
