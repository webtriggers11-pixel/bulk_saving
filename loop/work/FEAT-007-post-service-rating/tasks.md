# Tasks FEAT-007 — Post-service rating

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-007): ...`) AND append a LOG.md entry.

- [ ] T1: Prisma schema — `Rating` model; migration via `migrate diff`, applied with `migrate deploy` (needs owner approval); drift check clean.
- [ ] T2: `@bulk/shared` contracts — `RatingDto`, `RateRoundBody`, `MyRoundDto`, and the admin/vendor/dashboard additions; new error codes. — depends: T1
- [ ] T3: `RatingsService.upsertForRound` — society/participation/status guards, upsert, and the DELIVERED → RATED flip through `RoundsService.markRated()`. Unit + integration tests incl. "a rejected rating writes nothing". — depends: T2
- [ ] T4: `RatingsService.removeForRound` + `GET /rounds/mine` read (any status, newest first, with `myRating`). — depends: T3
- [ ] T5: Resident endpoints + `RateRoundDto` validation; integration tests for 200/400/403/404/409 and the second-rating no-transition case. — depends: T4
- [ ] T6: Admin round detail — per-participant rating + round average/count; SUPER_ADMIN-only, 403 for a resident token. — depends: T3
- [ ] T7: Vendor `averageRating` / `ratingCount`, and dashboard `ratings {average, count}`; tests scoped to fixtures (never a platform-wide absolute). — depends: T6
- [ ] T8: ROUND_DELIVERED message asks for a rating again; flip the FEAT-006 test that forbids the phrase, with a comment saying why it is now true. — depends: T5
- [ ] T9: V2 — independent code-reviewer subagent runs verify.sh ITSELF and reviews the diff vs spec + ADR-0017. — depends: T7, T8
- [ ] T10: V3 — fresh double run, both logged; REGISTRY → done; LOG close entry. — depends: T9

## Deliberately NOT in this work item

- The resident rating UI. FEAT-008 owns `apps/web` right now; the screen lands as its own
  work item against the API this ships. `GET /rounds/mine` is included here precisely so
  FEAT-008's "My Requests" tab has a backend to call.
