# Tasks FEAT-010 — Per-service unit labels

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes (lint → typecheck →
build → tests). After each: commit and append to LOG.md.

- [x] T1: Schema + additive migration (`unitLabel`, `unitLabelPlural` NOT NULL backfilled, `unitDescription` nullable); drift check clean.
- [x] T2: `@bulk/shared` — the three fields on `RoundServiceSummary`, `AdminServiceDto` and the service create/update bodies. — depends: T1
- [x] T3: Backend — mappers carry the fields; `POST`/`PATCH /admin/services` validate them (label 1–24, description ≤140, defaults when omitted); tests. — depends: T2
- [x] T4: Backend `units.ts` formatter + the four SMS templates ("2 rooms of Painting at ₹3,500/room"); a service with no label still renders "unit(s)". — depends: T3
- [x] T5: Web `lib/units.ts` formatter, pinned by test to the backend's behaviour (no runtime import from `@bulk/shared` — CHORE-004). — depends: T2
- [x] T6: Resident renders — RoundsPage (join label, pledge line, counter, price), MyRequestsPage (pledge, price), scope sentence where a resident joins. — depends: T5
- [x] T7: Admin renders — round detail (units/residents, tiers, participants), dashboard demand, new-round tier labels, and the service form fields. — depends: T5
- [x] T8: Seed gives the five seeded services real labels (Painting → room, with scope). — depends: T3
- [x] T9: E2E — `node scripts/e2e-smoke.mjs` green, with a check that the label round-trips through the API. — depends: T4, T8
- [ ] T10: V2 — independent reviewer runs the gate ITSELF and reviews the diff vs spec + ADR-0019. — depends: T6, T7, T9
- [ ] T11: V3 — double run on a quiescent tree; REGISTRY → done; LOG close entry. — depends: T10

## Notes from the build

- **One AC turned out to be wrong and was corrected, not fudged:** the spec asked for the
  dashboard's demand column to name the unit. It cannot — `unitsPledged` per society sums
  units ACROSS services, so 3 rooms of painting and 2 ACs are "5" and no single word is
  correct. The column now says "Units (mixed)" and the card says the counts are not
  comparable. Same incoherence ADR-0019 cites for rejecting per-society labels.
- Adding required fields to `RoundServiceSummary` broke 7 fixture construction sites at
  compile time — which is exactly why they were made required rather than optional.
- Two of those fixtures and three expectations live in the other session's files
  (`RoundsPage.test.tsx`, `offline-pages.test.tsx`): unavoidable, since the contract changed.
  The expectations got STRONGER (`6 units pledged` → `6 AC units pledged`).
- Painting's `indicativePrice` moved 15000 → 3500, because it was priced per flat while its
  unit is now a room. That is a data fix the label change exposed.

## Render-site checklist (the risk is a missed one)

SMS: joined · closing-soon · closed-met · assigned.
Web resident: RoundsPage join label · pledge line · live counter · price-per-unit ·
MyRequestsPage pledge · MyRequestsPage price.
Web admin: round detail units/residents · round detail tiers · participant units ·
dashboard demand · new-round tier thresholds · service form.

## Not in this work item

- Per-society or per-round overrides, structured unit types, quantity pickers (ADR-0019).
- Any change to counting, thresholds, pricing or billing.
