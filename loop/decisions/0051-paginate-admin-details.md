# ADR-0051: Page every growing admin list, with searchable society pickers and SQL aggregates

**Status:** Accepted · **Date:** 2026-11-24 · **Deciders:** Vivek ("server side pagination for everything … should not be lagged … use cursor"), agent · **Work item:** FEAT-044 · **Extends:** ADR-0035 (keyset pagination)

## Decisions
1. **Same contract as ADR-0035 for the rest:** `GET /admin/societies` (by name + id; `q` matches name, city or a PIN code prefix; `status`), `GET /admin/residents/:id/pledges` (newest first), `GET /admin/rounds/:id/participants` (joined first), `GET /admin/dashboard/demand` (by society name). Each is `Page<T>`, keyset with `id` as the tiebreaker, limit 1–50, and a gone cursor gives an empty page.
2. **Details keep the numbers and drop the lists.** The user detail keeps `pledgeCount` (live pledges). The round detail keeps its `payments` summary (all participants) and its rating aggregate. The dashboard drops `demandBySociety`.
3. **Society pickers become `SocietySelect`:** a native select of the first 50 by name. A search box appears once there are more and stays once shown, labelled per field. A "Show more" button under the select loads the next page; an option that loads would fire on every arrow key (V2 P3-2). A chosen society not on a loaded page is fetched by id so the select still shows it. The Services "Manage societies" panel pages its own societies, and only while open.
4. **Aggregates in Postgres, not in memory.** Platform payment totals are one `SUM(CASE …)` and demand's distinct residents is one `COUNT(DISTINCT)`, both as tagged `$queryRaw` (parameterised) in `RoundsAdminService`. ADR-0005 bans raw SQL in controllers, not in services. Both used to load every payable participant / open pledge.
5. **Bounded by design (not paged):** the overview's 5 recents, the dashboard asks (`take: 100`, top 20 plus a total), and each service's `offerings` array (one small row per society that offers it). Also the **service and vendor pickers** (New round, Assign). They walk the paged API once (`fetchAllPages`) because they are admin-curated catalogs of dozens to hundreds, not lists that grow with users. Services are filtered to active on the server (V2 P2-1). Past 2,000 items the walk **throws** instead of truncating silently, and the picker shows its error. That error is the trigger to give them search like `SocietySelect`.
6. **The per-round payment summary** (round detail, admin rounds rows) still reads that round's participants' `units`/`paid` to sum them. This is bounded by one society's households and accepted for now (V2 P3-4). Revisit trigger below.

## Confidence
**Med-High.** The payment SQL has an exact-delta test: payable statuses only, price-less rounds excluded, paid vs unpaid split. Each endpoint has an integration test that walks every page (exact sizes, no repeats, total), plus search, 403, 404 and 400. The picker has unit tests for the load-more option, search and the off-page chosen value. The payment SQL duplicates `computePaymentSummary`'s rule; the delta test pins it.

## Research depth
**Judgment call** on top of ADR-0035, which researched keyset vs offset.

## Consequences
Good: no admin screen loads an unbounded list. Totals are computed by the database. Pickers stay usable with thousands of societies. Bad: a picker is a select plus a search box rather than a true combobox. Two raw-SQL aggregates must follow any change to the payment rule.

## Revisit trigger
A service offered in thousands of societies → page `offerings`. The admin rounds list's per-round payment summary still loads each round's participants (bounded per round) → move it to a groupBy if that list gets slow.
