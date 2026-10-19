# FEAT-023 — plan

Frontend only. No new API, no new dependency, no ADR (uses ADR-0021/0022/0031 vocabulary and the FEAT-021 deep link).

1. `features/home/GroupBuysLead.tsx` — the accent card: `useRounds()` (live-polled), counts via the same maths as `RoundsSummary`, up to three `RoundDto` rows (`formatRupees`, `formatCountdown`), "You're in" mark, "See all group buys". Empty branch. Rows are `<button>`s (navigate) — ≥ `min-h-touch`.
2. `HomePage.tsx` — bento becomes: identity (wide, glass) · Group buys lead (wide, accent) · Your society + Services (two tiles) · super-admin entry. Browse-services tile keeps the `Browse services` button name (tests).
3. `HomeSkeleton.tsx` — mirrors the new geometry.
4. Tests: `GroupBuysLead.test.tsx` (counts, rows, deep link, empty, failed rounds query) + `HomePage.test.tsx` kept green.
