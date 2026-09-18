# Tasks FEAT-010 — Per-service unit labels

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes (lint → typecheck →
build → tests). After each: commit and append to LOG.md.

- [x] T1: Schema + additive migration (`unitLabel`, `unitLabelPlural` NOT NULL backfilled, `unitDescription` nullable); drift check clean.
- [x] T2: `@bulk/shared` — the three fields on `RoundServiceSummary`, `AdminServiceDto` and the service create/update bodies. — depends: T1
- [x] T3: Backend — mappers carry the fields; `POST`/`PATCH /admin/services` validate them (label 1–24, description ≤140, defaults when omitted); tests. — depends: T2
- [x] T4: Backend `units.ts` formatter + the four SMS templates ("2 rooms of Painting at ₹3,500/room"); a service with no label still renders "unit(s)". — depends: T3
- [x] T5: Web `lib/units.ts` formatter, pinned by test to the backend's behaviour (no runtime import from `@bulk/shared` — CHORE-004). — depends: T2
- [x] T6: Resident renders — RoundsPage (join label, pledge line, counter, price), MyRequestsPage (pledge, price), scope sentence where a resident joins. — depends: T5
- [x] T7: Admin renders — round detail (units/residents, tiers, participants, and the
      per-unit PRICE field), dashboard per-round cell, new-round tier labels. NOT "the
      service form": there is no admin services page in the web app at all (corrected AC in
      spec.md) — the unit fields are accepted and validated on the API instead, and the
      missing UI is CHORE-006. — depends: T5
- [x] T8: Seed gives the five seeded services real labels (Painting → room, with scope). — depends: T3
- [x] T9: E2E — `node scripts/e2e-smoke.mjs` green, with a check that the label round-trips through the API. — depends: T4, T8
- [ ] T10: V2 — independent reviewer runs the gate ITSELF and reviews the diff vs spec + ADR-0019. — depends: T6, T7, T9
- [x] T11: V3 — **passed on the second attempt, after BUG-006 was fixed.** The first attempt
      failed the flake check, and chasing that uncovered BUG-006 (parallel suites sharing one
      DB/Redis). With `--runInBand`, five consecutive verify.sh runs are identical: backend
      317 / 24 suites, web 182 / 35 files. The original failure, kept for the record:
      **FAILED the flake check, so FEAT-010 stayed open.** Run 1 exit 1, run 2 exit 0
      on a clean tree with no dev server: one admin-suite test got 401 where 409 was expected
      (`admin-dashboard.integration.spec.ts:328`). Three further full backend runs were clean
      (311/311 each), so it is roughly 1 in 9. CLAUDE.md rule 5: different results between
      back-to-back runs is a flaky test, is a BUG, and blocks the close. Registered as
      **BUG-005** with the signature and the ruled-out causes. Re-run V3 when that is settled.

## V2 outcome (2026-09-18)

Independent reviewer ran the gate itself (exit 0) and mutation-tested the diff in an
out-of-repo copy. CHANGES REQUESTED, **no P0** — it confirmed the mechanic is genuinely
untouched: the money path (`amountDue = finalPrice × units`) and the pricing/transition files
are absent from the diff.

Fixed:

- **P1-E — "1 rooms" in a resident SMS.** A first tier threshold of 1 is allowed, and the
  closing-soon body interpolated the plural raw: *"0 of 1 rooms pledged … doesn't reach 1
  rooms"*. That is the exact failure ADR-0019 stores the plural to prevent, in the one channel
  it was written for. Both counts now go through `formatUnits`, with a test at threshold 1.
- **P1-D — singular and plural could be set independently.** `POST` with only `unitLabel`
  returned 201 and left the plural at `units`, so a service counted in rooms rendered "1 room"
  and "2 units", and its SMS "3 units of Painting at ₹3500/room". Now refused as a pair on
  create AND PATCH — deriving the missing side is what the ADR rejected.
- **P1-A / P1-B — two admin sites were still generic, one of them the money field.** The tier
  list read "5+ units" two lines under "Rooms / residents", and the assign form said "Final
  price per unit" — the very number `amountDue` bills against.
- **P1-C — the resident catalog showed a re-priced number with no unit.** `ServiceDto` never
  carried the labels, and this feature had moved Painting 15000 → 3500 (per flat → per room),
  so "From ₹3,500" silently changed meaning. Now "From ₹3,500 / room", with the scope sentence.
- **P1-G** — the "service form" AC was ticked without a form existing. Corrected, and the real
  gap registered as CHORE-006.
- **P1-F** — no LOG entries for FEAT-010. Written as one honest catch-up.
- P2s taken: `MAX_UNIT_LABEL` 24 → 16 (the label appears five times in one closing-soon body,
  measured at 314/320, so a longer service name truncated the "won't go ahead" clause) with a
  test at the maximum; the dashboard's PER-ROUND cell now names the unit (the mixed-service
  total still cannot); whitespace-only scope no longer renders an empty paragraph; and both
  formatters are pinned by ONE shared case table, because per-app tests let an implementation
  drift together with its own test.

The reviewer's mutation testing also showed `AdminRoundDetailPage.test.tsx` stayed green when
the label helpers were stubbed — which is precisely where P1-A and P1-B hid. Admin label
renders now have assertions.

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
