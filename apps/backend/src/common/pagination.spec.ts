import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageArgs, pageOf } from './pagination';

/**
 * FEAT-025 (ADR-0035). A cursor is only meaningful under a TOTAL order, so every paged
 * `findMany` must end its `orderBy` with `id`. Prisma adds an implicit id order on cursor
 * queries, which is why an integration test cannot tell a missing tiebreaker apart from a
 * present one (V2 round 2) — this reads the source instead, deterministically.
 */
const PAGED = [
  'modules/rounds/rounds.service.ts',
  'modules/rounds/rounds-admin.service.ts',
  'modules/catalog/catalog.service.ts',
  'modules/catalog/catalog-admin.service.ts',
  'modules/vendors/vendors.service.ts',
];

describe('pagination', () => {
  it('every paged findMany ends its orderBy with id', () => {
    const missing: string[] = [];
    for (const file of PAGED) {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      const calls = source.split('...pageArgs(').slice(0, -1);
      if (calls.length === 0) missing.push(`${file}: no paged findMany found`);
      for (const before of calls) {
        // The LAST array-form orderBy before the slice: an include's nested `orderBy: { … }`
        // (catalog-admin's offerings) is not the paged query's order.
        const order = before.slice(before.lastIndexOf('orderBy: ['));
        if (!/orderBy:\s*\[[\s\S]*\{\s*id:\s*'(asc|desc)'\s*\}\s*\]/.test(order)) missing.push(file);
      }
    }
    expect(missing).toEqual([]);
  });

  it('pageArgs: clamps the limit, never skips, seeks by id', () => {
    expect(pageArgs({})).toEqual({ take: 22 });
    expect(pageArgs({ limit: 5, cursor: 'x' })).toEqual({ take: 7, cursor: { id: 'x' } });
    expect(pageArgs({ limit: 999 })).toEqual({ take: 52 });
    // 0 is refused by the DTO before this; as a bare value it falls back to the default.
    expect(pageArgs({ limit: 0 })).toEqual({ take: 22 });
  });

  it('pageOf: removes the cursor row, caps at the limit, points at the last item', () => {
    const rows = ['c', 'a', 'b', 'd'].map((id) => ({ id }));
    const page = pageOf(rows, { limit: 2, cursor: 'c' }, 9, (row) => row.id);
    expect(page).toEqual({ items: ['a', 'b'], nextCursor: 'b', total: 9 });
    // The cursor row is gone from the fetch (it stopped matching): still at most `limit`.
    const stale = pageOf(['a', 'b', 'd', 'e'].map((id) => ({ id })), { limit: 2, cursor: 'c' }, 9, (row) => row.id);
    expect(stale).toEqual({ items: ['a', 'b'], nextCursor: 'b', total: 9 });
    expect(pageOf([{ id: 'a' }], { limit: 2 }, 1, (row) => row.id)).toEqual({ items: ['a'], nextCursor: null, total: 1 });
  });
});
