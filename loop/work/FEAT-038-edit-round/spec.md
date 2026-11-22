# FEAT-038: Edit an open round: deadline and price tiers

**Status:** in-progress · **Priority:** P1 · **Owner:** owner ("Once I have created a round, I am not able to edit it. Can you please update that so we can update it also?") / agent · **Opened:** 2026-11-23

## Acceptance criteria
- [ ] AC1 — `PATCH /admin/rounds/:id {deadline?, tiers?}` (SUPER_ADMIN). OPEN rounds only; any other status → 409 `ROUND_CLOSED`. Unknown id → 404. An empty body → 400. The same validation as create: the deadline is in the future, and tiers are non-empty, positive integers with strictly ascending thresholds.
- [ ] AC2 — The edit runs under the round row lock (ADR-0004). Tiers are replaced as a set. Pledges and `unitsCount` are untouched, and the current price is re-derived from the new tiers.
- [ ] AC3 — A deadline change moves the close job and the "closing soon" reminder. The deadline close job re-checks the deadline under the lock and does nothing if the round isn't due yet, so a job already running when the deadline is extended can't close the round early. Residents who already got the reminder aren't messaged again (the dedupe key).
- [ ] AC4 — Society and service can't be edited (pledges and asks belong to that pair). To change them, cancel the round and open a new one.
- [ ] AC5 — Web: the admin round page shows **Edit round** on an OPEN round: a deadline field and a tier editor prefilled with the current values; Save, Cancel and errors shown inline. The page refreshes, and the admin dashboard, rounds list and overview are invalidated (residents' sessions refetch on their own).
- [ ] AC6 — Tests + gate; V2; V3.
