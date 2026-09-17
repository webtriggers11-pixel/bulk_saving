# Tasks FEAT-007 — Post-service rating

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-007): ...`) AND append a LOG.md entry.

- [x] T1: Prisma schema — `Rating` model; migration via `migrate diff`, applied with `migrate deploy` (needs owner approval); drift check clean.
- [x] T2: `@bulk/shared` contracts — `RatingDto`, `RateRoundBody`, `MyRoundDto`, and the admin/vendor/dashboard additions; new error codes. — depends: T1
- [x] T3: `RatingsService.upsertForRound` — society/participation/status guards, upsert, and the DELIVERED → RATED flip through `RoundsService.markRated()`. Unit + integration tests incl. "a rejected rating writes nothing". — depends: T2
- [x] T4: `RatingsService.removeForRound` + `GET /rounds/mine` read (any status, newest first, with `myRating`). — depends: T3
- [x] T5: Resident endpoints + `RateRoundDto` validation; integration tests for 200/400/403/404/409 and the second-rating no-transition case. — depends: T4
- [x] T6: Admin round detail — per-participant rating + round average/count; SUPER_ADMIN-only, 403 for a resident token. — depends: T3
- [x] T7: Vendor `averageRating` / `ratingCount`, and dashboard `ratings {average, count}`; tests scoped to fixtures (never a platform-wide absolute). — depends: T6
- [x] T8: ROUND_DELIVERED message asks for a rating again; flip the FEAT-006 test that forbids the phrase, with a comment saying why it is now true. — depends: T5
- [x] T9: V2 — independent code-reviewer subagent runs verify.sh ITSELF and reviews the diff vs spec + ADR-0017. — depends: T7, T8
- [x] T10: V3 — fresh double run, both logged; REGISTRY → done; LOG close entry. — depends: T9

## V2 outcome (2026-09-18)

Independent reviewer ran verify.sh itself (exit 0, backend 284 / 22 suites, web 92 / 25)
and wrote a live concurrency probe of its own. Verdict CHANGES REQUESTED, **no P0**.

- **P1-1 — a REAL bug, reproduced live.** Two participants rating the same DELIVERED
  round simultaneously: both ratings saved, but the loser of the status race got
  `409 INVALID_ROUND_TRANSITION` ("a round cannot move from RATED to RATED") for a write
  that had succeeded. The status read before the upsert is unlocked, so both callers
  believed they were first. This is the DESIGNED traffic pattern — the delivered SMS asks
  every participant to rate at the same moment. Fixed with
  `RoundsService.markRatedIfDelivered()`, which re-decides under the row lock and no-ops
  when the round has already moved. A regression test fires both PUTs with `Promise.all`;
  it was confirmed to FAIL against the old code (409) before being kept.
- **P1-2 — non-atomic upsert + flip: accepted by design**, not changed. One shared
  transaction would roll the rating back on conflict, turning a cosmetic error into a lost
  rating. Reasoning recorded in ADR-0017's amendment.
- **P1-3 — the vendor-aggregate test was vacuous** (`count >= 2`, `0 < avg <= 5` passes
  even if every rating is attributed to every vendor). Replaced with exact per-vendor
  assertions across two vendors, a zero-rating vendor asserting `{ null, 0 }`, and a
  one-decimal rounding case.
- **P1-4 — framework bookkeeping was missing**: no LOG entries, no ticked boxes, and
  CHORE-003 folded into the feature commit. Fixed here and in LOG.md.
- P2s fixed in the same pass: the payment response no longer reports `rating: null` for a
  resident who has rated; three dead aggregation helpers deleted and the vendor grouping
  shared as one pure function (it was duplicated); the comment is trimmed BEFORE the
  length check; the dashboard delta test no longer assumes it is the only writer; a
  "newest first" assertion added; rounding no longer loses 4.35 → 4.3 to binary float;
  and two dishonest E2E checks fixed — a scenario named "notifications" that verified no
  notification, and a DELIVERED-count check that passed only on leftover data.

## Deliberately NOT in this work item

- The resident rating UI. FEAT-008 owns `apps/web` right now; the screen lands as its own
  work item against the API this ships. `GET /rounds/mine` is included here precisely so
  FEAT-008's "My Requests" tab has a backend to call.

## P2 follow-ups (triage as CHOREs)

- **Admin UI shows none of this yet.** `averageRating`, `ratingCount` and the per-round
  ratings exist only in the API; the admin pages render none of them, so user stories 4–6
  are true at the contract level and not on screen. `apps/web` is FEAT-008's while that
  runs — this needs its own item after it lands.
- `VendorsService.list` loads every Rating row to compute averages — fine now, and
  ADR-0017 already carries the revisit trigger.
- The resident rating UI (the whole point, from a resident's perspective) is still
  unbuilt, for the same ownership reason.
