# Tasks FEAT-009 — Rating UI

Dependency-ordered. Check a box only when verification passes.
Note: full `verify.sh` is deliberately deferred while the FEAT-008 session verifies —
the backend suites share one Postgres/Redis. Web-only checks run meanwhile.

- [x] T1: `rating.api.ts` + `useRating.ts` (invalidate `['rounds']` only, non-optimistic).
- [x] T2: `StarRating` as a real radiogroup, keyboard-operable, with a read-only mode that keeps FEAT-008's `my-rating` contract. Tests: semantics, selection, disabled, read-only.
- [x] T3: `RateRound` — unrated / saved / editing states, in-flight disable, failed-write comment retention. — depends: T2
- [x] T4: Wire into `MyRequestsPage` for DELIVERED/RATED only; FEAT-008's 10 existing tests still pass untouched. — depends: T3
- [x] T5: `formatRating.ts` + admin surfaces (vendor average with count, round summary + per-participant column), null never rendered as 0. — depends: T1
- [x] T6: Web lint + typecheck + full web suite + `pnpm --filter web build` all green (135 tests / 29 files).
- [ ] T7: Full `bash scripts/verify.sh` including the CHORE-004 build step — BLOCKED until the FEAT-008 session's V3 lands (shared DB).
- [ ] T8: V2 — independent reviewer runs the gate itself and reviews the diff vs spec + ADR-0018. — depends: T7
- [ ] T9: V3 — fresh double run; REGISTRY → done; LOG close entry. — depends: T8

## Not in this work item

- Any backend change (FEAT-007's API is fixed and tested).
- An in-app nudge to rate (a tab badge or Home card) — it would touch FEAT-008's nav, which
  has just settled. Recorded as ADR-0018's first revisit trigger.
- Browser-level verification of these screens: the Chrome extension cannot load localhost
  (owner action). Everything here is proven by component tests, not by a real browser.
