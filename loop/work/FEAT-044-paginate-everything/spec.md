# FEAT-044: Server-side (cursor) pagination on every list that can grow

**Status:** done · **Priority:** P1 · **Owner:** owner / agent · **Opened:** 2026-11-24

**Owner request (2026-11-24):** "make sure … we added server side pagination for everything because later on when we have much more data it should not be lagged. So use server side pagination, use cursor … and proper working."

## Now
FEAT-025 (ADR-0035's `Page<T>` keyset envelope) paginated `GET /rounds`, `/rounds/mine`, `/catalog`, `/admin/rounds`, `/admin/services` and `/admin/vendors`. Lists added since (societies FEAT-032, users FEAT-033, the admin requests/asks page and reports FEAT-037/041, round participants, notifications, anything else) have to be audited.

## Audit (2026-11-24, every GET in apps/backend/src)
| Endpoint | Returns | Verdict |
|---|---|---|
| `GET /rounds`, `/rounds/mine`, `/catalog`, `/admin/rounds`, `/admin/services`, `/admin/vendors` | `Page<T>` | paginated (FEAT-025) |
| `GET /admin/residents` | `Page<T>` | paginated (FEAT-033) |
| `GET /admin/societies` | every society, unbounded (`listAll`) | **to paginate**, plus `q` search. Also feeds four pickers (New round, Services offerings, Users filter, Dashboard), which move to a searchable, paged picker |
| `GET /admin/residents/:id` | the user plus **every** pledge | **to paginate**: `GET /admin/residents/:id/pledges`; the detail keeps counts only |
| `GET /admin/rounds/:id` | the round plus **every** participant | **to paginate**: `GET /admin/rounds/:id/participants`; the detail keeps totals (units, collected count) |
| `GET /admin/dashboard` | `demandBySociety` has one row per society; payments are summed by loading every payable round's participants into memory | **to paginate** demand as `GET /admin/dashboard/demand`. Payments become one SQL aggregate (a `$queryRaw` SUM in the service; ADR-0005 allows raw SQL in services, not controllers) |
| service / vendor pickers (`useAllServices`, `useAllVendors`) | walk every page of `/admin/services` / `/admin/vendors` | bounded by design (curated catalogs; ADR-0051 §5): services filtered to active on the server, and the walk throws past 2,000 instead of truncating (V2 P2-1) |
| `GET /admin/overview` | `take: RECENT` (5) recent societies/users | bounded by design |
| dashboard asks (`waitingAskGroups`) | `take: 100`, then top 20 | bounded by design (a to-do list; total `waiting` reported) |
| `/auth/*`, `/push/*`, `/dev/*`, `/health`, `GET /residents/:id`, `GET /admin/societies/:id` | single objects | n/a |

## Acceptance criteria
- [x] AC1. Audit: every endpoint returning an array whose length grows with data is listed in this spec, with paginated / to-paginate / bounded-by-design (with the bound stated).
- [x] AC2. Every to-paginate endpoint uses the same `Page<T>` envelope, keyset on a deterministic order + `id`, `limit` 1–50, an opaque cursor, 400 on a bad cursor, filters and search applied before paging, and `total` for the filtered set.
- [x] AC3. Web consumers use `useInfiniteQuery` + the shared "Show more (N left)" control; filters reset pages; nothing is fetched as "all then sliced" on the client.
- [x] AC4. Indexes: Society (name, id) is a small table, sorted per page. RoundParticipant already has `@@index([roundId])`, and residentId is covered by `@@unique([roundId, residentId])`'s FK lookups. No migration was needed; revisit if a list gets slow.
- [x] AC5. Tests per endpoint (first page, next page, last page, bad cursor, filter + paging) + gate; V2; V3.


Pickers: see ADR-0051 §3. Bounded by design: ADR-0051 §5.
