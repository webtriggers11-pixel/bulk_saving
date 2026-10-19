import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, type Page, type PageQuery } from '@bulk/shared';

/**
 * Keyset pagination (FEAT-025, ADR-0035). Every list takes `limit` and `cursor`, returns a
 * `Page<T>`, and orders by its own keys PLUS `id` so the order is total — a cursor is only
 * meaningful under a total order.
 *
 * The global ValidationPipe validates but does not transform (see list-filters.ts), so
 * `limit` is validated as a number through `@Type` but ARRIVES as the raw string; `pageArgs`
 * is where it becomes a number.
 */
export class PageQueryDto implements PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_LIMIT_MAX)
  limit?: number;

  /** The id of the last item the client has. Opaque to the client; an id to us. */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  cursor?: string;
}

/** The page size a query asks for, clamped. */
export function pageLimit(query: PageQuery): number {
  return Math.min(PAGE_LIMIT_MAX, Math.max(1, Number(query.limit ?? PAGE_LIMIT_DEFAULT) || PAGE_LIMIT_DEFAULT));
}

/**
 * The Prisma `findMany` slice for one page. Prisma's `cursor` seeks to the cursor row's
 * position in the ORDER and then applies `where` — so when the cursor row still exists but
 * no longer matches (a round that closed while the resident was on page 1), the first row
 * returned is the next MATCHING row, and a `skip: 1` would silently drop it (V2 P2). So: no
 * skip; two spare rows (the cursor row itself, when it still matches, plus the one that
 * says "there is more"); `pageOf` removes the cursor row by id.
 */
export function pageArgs(query: PageQuery): { take: number; cursor?: { id: string } } {
  return {
    take: pageLimit(query) + 2,
    ...(query.cursor ? { cursor: { id: query.cursor } } : {}),
  };
}

/** Shape one page from the (up to) `limit + 2` fetched rows and the filtered count. */
export function pageOf<Row extends { id: string }, T>(
  rows: Row[],
  query: PageQuery,
  total: number,
  map: (row: Row) => T,
): Page<T> {
  const limit = pageLimit(query);
  const after = query.cursor ? rows.filter((row) => row.id !== query.cursor) : rows;
  const more = after.length > limit;
  const slice = more ? after.slice(0, limit) : after;
  return {
    items: slice.map(map),
    nextCursor: more && slice.length > 0 ? slice[slice.length - 1].id : null,
    total,
  };
}
