# FEAT-044: Server-side (cursor) pagination on every list that can grow

**Status:** triaged · **Priority:** P1 · **Owner:** owner / agent · **Opened:** 2026-11-24

**Owner request (2026-11-24):** "make sure … we added server side pagination for everything because later on when we have much more data it should not be lagged. So use server side pagination, use cursor … and proper working."

## Now
FEAT-025 (ADR-0035's `Page<T>` keyset envelope) paginated `GET /rounds`, `/rounds/mine`, `/catalog`, `/admin/rounds`, `/admin/services` and `/admin/vendors`. Lists added since (societies FEAT-032, users FEAT-033, the admin requests/asks page and reports FEAT-037/041, round participants, notifications, anything else) have to be audited.

## Acceptance criteria (draft)
- AC1. Audit: every endpoint returning an array whose length grows with data is listed in this spec, with paginated / to-paginate / bounded-by-design (with the bound stated).
- AC2. Every to-paginate endpoint uses the same `Page<T>` envelope, keyset on a deterministic order + `id`, `limit` 1–50, an opaque cursor, 400 on a bad cursor, filters and search applied before paging, and `total` for the filtered set.
- AC3. Web consumers use `useInfiniteQuery` + the shared "Show more (N left)" control; filters reset pages; nothing is fetched as "all then sliced" on the client.
- AC4. Indexes back each keyset order (additive migration if needed; owner approval before the shared DB).
- AC5. Tests per endpoint (first page, next page, last page, bad cursor, filter + paging) + gate; V2; V3.
