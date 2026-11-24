# ADR-0051: Page every growing admin list, with searchable society pickers and SQL aggregates

**Status:** Accepted · **Date:** 2026-11-24 · **Deciders:** Vivek ("server side pagination for everything … should not be lagged … use cursor"), agent · **Work item:** FEAT-044 · **Extends:** ADR-0035 (keyset pagination)

## Decisions
1. **Same contract as ADR-0035 for the rest:** `GET /admin/societies` (by name + id; `q` matches name, city or a PIN code prefix; `status`), `GET /admin/residents/:id/pledges` (newest first), `GET /admin/rounds/:id/participants` (joined first), `GET /admin/dashboard/demand` (by society name). Each is `Page<T>`, keyset with `id` as the tiebreaker, limit 1–50, and a gone cursor gives an empty page.
2. **Details keep the numbers and drop the lists.** The user detail keeps `pledgeCount` (live pledges). The round detail keeps its `payments` summary (all participants) and its rating aggregate. The dashboard drops `demandBySociety`.
3. **Society pickers become `SocietySelect`:** a native select of the first 50 by name. A search box appears once there are more, and a "Show more societies (N more)…" option loads the next page. A chosen society not on a loaded page is fetched by id so the select still shows it. The Services "Manage societies" panel pages its own societies, and only while open.
4. **Aggregates in Postgres, not in memory.** Platform payment totals are one `SUM(CASE …)` and demand's distinct residents is one `COUNT(DISTINCT)`, both as tagged `$queryRaw` (parameterised) in `RoundsAdminService`. ADR-0005 bans raw SQL in controllers, not in services. Both used to load every payable participant / open pledge.
5. **Bounded by design (not paged):** the overview's 5 recents, the dashboard asks (`take: 100`, top 20 plus a total), and each service's `offerings` array (one small row per society that offers it).

## Confidence
**Med-High.** Each endpoint has an integration test that walks every page (exact sizes, no repeats, total), plus search, 403, 404 and 400. The picker has unit tests for the load-more option, search and the off-page chosen value. Medium on one point: the payment SQL duplicates `computePaymentSummary`'s rule. The existing dashboard test pins its result on fixtures.

## Research depth
**Judgment call** on top of ADR-0035, which researched keyset vs offset.

## Consequences
Good: no admin screen loads an unbounded list. Totals are computed by the database. Pickers stay usable with thousands of societies. Bad: a picker is a select plus a search box rather than a true combobox. Two raw-SQL aggregates must follow any change to the payment rule.

## Revisit trigger
A service offered in thousands of societies → page `offerings`. The admin rounds list's per-round payment summary still loads each round's participants (bounded per round) → move it to a groupBy if that list gets slow.
