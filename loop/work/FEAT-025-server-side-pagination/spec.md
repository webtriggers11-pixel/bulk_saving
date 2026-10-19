# FEAT-025 — Server-side pagination on the list endpoints

**Status:** specced · **Priority:** P1 · **Owner:** owner (requested) / agent · **Opened:** 2026-10-19

## Problem / Why

Owner: "use server side pagination". Every list endpoint returns the whole result: `GET
/rounds`, `/rounds/mine` (grows forever per resident), `/catalog`, `/admin/services`,
`/admin/vendors`, and `/admin/rounds` — which is silently capped at 200 rows, so an operator
with 201 rounds never sees the oldest one and is not told. A list that cannot grow past one
response is a ceiling on the product.

## User stories

1. As a resident, My Requests and the catalog open fast however long my history is, and
   "Show more" brings the rest.
2. As the admin, every list is complete — pages, never a hidden cap.

## Acceptance criteria

- [ ] AC1 — One envelope for every list: `Page<T> = { items: T[]; nextCursor: string | null; total: number }`.
      Query: `limit` (1–50, default 20, DTO-validated) and `cursor` (opaque: the last item's id).
      Keyset pagination on a deterministic order (the existing order + `id` as the tiebreaker);
      no offset. A bad cursor → 400 VALIDATION, never a 500.
- [ ] AC2 — Endpoints: `GET /rounds`, `GET /rounds/mine`, `GET /catalog`, `GET /admin/rounds`,
      `GET /admin/services`, `GET /admin/vendors`. Filters (FEAT-015) still apply; `total`
      counts the filtered set. `ADMIN_ROUNDS_LIMIT` is retired.
- [ ] AC3 — Web: every consumer moves to `useInfiniteQuery` with a "Show more (N left)" control
      under the list; live polling (ADR-0010) refetches the loaded pages; filters reset the
      pages. Summaries (Rounds: Open · You're in · Could save; Home lead) use `total` for the
      count and the loaded rows for the rest — stated in the UI as "of N" where it matters.
- [ ] AC4 — `scripts/e2e-smoke.mjs` reads `.items`. Admin dashboard aggregates are unchanged
      (they were never lists).
- [ ] AC5 — Tests per endpoint: page boundaries (exactly `limit`, the next cursor, the last page
      has `nextCursor: null`), stable order across pages (no duplicate, no skip when a row is
      inserted between calls), tenancy on every page, filters + pagination together, DTO
      limits; web: "Show more" appends and disappears on the last page; gate green; V2; V3.
- [ ] AC6 — ADR-0035 records the contract (keyset, envelope, limits).

## Out of scope

- Participants on an admin round detail (bounded per round); notification/outbox internals;
  infinite scroll (an explicit control is the choice — it works offline-paused and is testable).
