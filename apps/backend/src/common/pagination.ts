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

/** The Prisma `findMany` slice for one page: one extra row tells us whether there is a next page. */
export function pageArgs(query: PageQuery): { take: number; skip?: number; cursor?: { id: string } } {
  const limit = Math.min(PAGE_LIMIT_MAX, Math.max(1, Number(query.limit ?? PAGE_LIMIT_DEFAULT) || PAGE_LIMIT_DEFAULT));
  return {
    take: limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  };
}

/** Shape one page from the `limit + 1` rows and the filtered count. */
export function pageOf<Row extends { id: string }, T>(
  rows: Row[],
  query: PageQuery,
  total: number,
  map: (row: Row) => T,
): Page<T> {
  const { take } = pageArgs(query);
  const limit = take - 1;
  const more = rows.length > limit;
  const slice = more ? rows.slice(0, limit) : rows;
  return {
    items: slice.map(map),
    nextCursor: more && slice.length > 0 ? slice[slice.length - 1].id : null,
    total,
  };
}
