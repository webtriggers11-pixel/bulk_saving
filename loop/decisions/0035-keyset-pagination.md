# ADR-0035: Every list is a page — keyset pagination, one envelope

**Status:** Accepted · **Date:** 2026-10-19 · **Deciders:** Vivek ("use server side pagination"), agent · **Work item:** FEAT-025
· **Builds on:** ADR-0005 (Prisma through services), ADR-0026 (server-side filters), ADR-0003 (tenancy)

## Confidence
**Level:** High (keyset on `(order, id)` is the textbook answer and is integration-tested at
the boundaries) · Medium (the chosen default page size, 20, is a guess at the phone's fold)

## Research depth
**Quick check** of Prisma's cursor semantics (`cursor` + `skip: 1` needs a unique, total order —
hence `id` as the last `orderBy` key everywhere) against the repo's existing orderings.

## Context
Every list endpoint returned the whole result; `/admin/rounds` was silently capped at 200.
The owner asked for server-side pagination. The choice is not whether, but how: offset or
keyset, and what the response looks like.

## Decisions
1. **Keyset, never offset.** `cursor` is the id of the last item the client has; the server
   seeks from it. Offset pages drift when a row is inserted (a resident joins, an admin opens a
   round) and cost a scan per page; keyset is stable and O(page).
2. **A total order on every list:** the existing `orderBy` plus `{ id }` as the final key. A
   cursor is only meaningful under a total order.
3. **One envelope:** `{ items, nextCursor, total }`. `nextCursor` is null on the last page;
   `total` is the filtered count — it is what a summary ("4 open") and a "Show more (N left)"
   control need, and one `count` per page is cheap at this scale.
4. **`limit` 1–50, default 20**, validated by DTO; a malformed `cursor` is a 400, and a cursor
   for a row that no longer exists is an empty page with `nextCursor: null` (Prisma's cursor
   on a missing row finds nothing), never a 500.
5. **Filters and tenancy are unchanged** (ADR-0026, ADR-0003): a page is a page OF the filtered,
   tenant-scoped set. The cursor carries no filter state; the client re-sends the filters.
6. **The client loads pages explicitly** ("Show more"), not by scroll: it is testable, honest
   offline (the control pauses), and does not fight the pull-to-refresh of an installed PWA.
   Live polling (ADR-0010) refetches the loaded pages.
7. **Summaries over loaded rows say so.** Counts use `total`; derived figures (You're in, Could
   save) are over what is loaded and the UI says "of N" where the two can differ.

## Consequences
Good: no hidden caps; lists scale; stable pages under live inserts.
Bad: a `count` per page; every list consumer re-written to pages; summaries are partial past
the first page (rare for a resident: more than 20 open rounds in one society is beyond v1).

## Revisit trigger
If any list routinely exceeds ~50 pages, or a client needs to jump to an arbitrary page,
reconsider (offset + total for the admin, keyset for residents).
