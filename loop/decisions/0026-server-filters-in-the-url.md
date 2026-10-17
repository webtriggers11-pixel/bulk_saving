# ADR-0026: Lists filter on the server, filter state lives in the URL, motion stays in CSS

**Status:** Accepted
**Date:** 2026-10-17 · **Deciders:** Vivek ("server side filters … microinteraction and animations"), agent · **Work item:** FEAT-015

## Confidence

**Level:** High
**Basis:** Each piece is the established default in this stack: Prisma `contains` +
`mode: 'insensitive'`, React Router search params, TanStack Query `placeholderData`. The
motion layer already exists (FEAT-011) and this adds named classes to it.

## Research depth

**Quick check** — Prisma's insensitive filter compiles to `ILIKE` on Postgres; at this
catalog's size (tens to low hundreds of rows per list) a sequential scan is sub-millisecond.

## Options considered

**Where filtering happens**
1. **Server, via validated query DTOs** — chosen. The owner asked for it, it scales past the
   point where the client holds the whole list, and the rounds list already works this way.
2. Client-side over the full list — rejected: what we have, and it does not survive growth.

**Search implementation**
1. **`ILIKE` via `contains` + `mode: 'insensitive'`** — chosen.
2. Postgres full-text / `pg_trgm` index — deferred: a migration and an extension for lists
   this small. Revisit trigger below.

**Where filter state lives**
1. **URL search params** — chosen: survives refresh, shareable, back button works, and it is
   the single source the query key is derived from. Writes use `replace`, so typing does
   not fill history.
2. Zustand — rejected: ARCHITECTURE puts server-state concerns in TanStack, and a store
   would lose filters on refresh just like component state.

**Motion**
1. **CSS classes in theme.css, no library** — chosen: one reduced-motion query already
   disables everything; a test forbids inline animation styles that would escape it; no new
   dependency.
2. framer-motion — rejected: ~40 kB for effects CSS does, and its animations would sit
   outside the reduced-motion guard unless every call site remembered.

## Decision

- Query params: `q` (trimmed, blank ignored, ≤ 80), `category`, `status=active|inactive`,
  plus per-list keys (`offeredIn`, `societyId`). Search is normalised in the service layer
  because the global ValidationPipe does not transform.
- The client keeps showing the previous result set (dimmed, `aria-busy`) while the next
  loads; search input is debounced 250 ms before it reaches the URL.

## Revisit triggers

- Any list over ~5,000 rows, or a filtered list p95 over 100 ms → `pg_trgm` + pagination.
- A second request for "remember my filters" across sessions → persist per-admin presets.
