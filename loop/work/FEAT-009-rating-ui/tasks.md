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
- [x] T7: Full `bash scripts/verify.sh` including the CHORE-004 build step (ran once the FEAT-008 session finished with the shared DB).
- [x] T8: V2 — independent reviewer runs the gate itself and reviews the diff vs spec + ADR-0018. — depends: T7
- [x] T9: V3 — fresh double run; REGISTRY → done; LOG close entry. — depends: T8

## V2 outcome (2026-09-18)

Independent reviewer ran the gate itself (exit 0) and returned CHANGES REQUESTED with a
**P0 that was live in shipped code**.

- **P0-1 — BUG-004's own symptom survived on `/admin/rounds/:id`.** Its four mutation
  buttons were fixed and its TWO READS were missed. Offline: layout + back link and nothing
  else; and the assign form claimed *"No active vendors. Add a vendor to assign this
  round."* — a false statement caused by a network failure, whose obvious remedy is to
  create a duplicate vendor. An empty-state string is an assertion about the world and
  needs the same care as an error state.
- **P1 — why it survived:** reverting every `queryStalled` call left all 153 web tests
  green. The read-side fix had only a unit test of the helper, and a helper's unit test is
  not a test of the fix. Five admin surfaces are now driven through `onlineManager`; two of
  those tests were confirmed to fail against the unfixed code before being kept.
- **P1 — a withdrawn rating came back pre-filled** in the reopened form, one tap from being
  re-created.
- **P1 — a successful save showed no confirmation until the refetch landed**, so a refetch
  that paused offline left the resident facing an empty form for a rating that WAS saved —
  ADR-0018's stated fear with the sign flipped. The card now trusts the mutation's result.
- **P1 — the star focus ring landed on a 1px transparent input** (WCAG 2.4.7), and stars
  were 26px targets where every button is 44px.
- **P2 — rating failures used the AUTH error map**, so "this round is not delivered yet"
  became "Something went wrong. Please try again.".
- **P2 — `OnboardingPage` was the last uncovered mutation surface.** All 15 `useMutation`
  call sites now have a paused state.
- **P1 — no LOG entries.** Written as one honest catch-up rather than back-dated per task.

### What CHORE-004 caught, one hour after being approved

Moving `MAX_RATING_COMMENT` into `@bulk/shared` and importing it broke the **production**
Vite build: shared builds to CommonJS, Rollup cannot see its named exports, and every other
web import from it is type-only for that reason. Vitest (esbuild) resolved it, so lint,
typecheck and 153 tests were all green. Only the build stage failed. The web app keeps the
type-only pattern and `rating-cap.test.ts` pins the two constants instead.

## Not in this work item

- Any backend change (FEAT-007's API is fixed and tested).
- An in-app nudge to rate (a tab badge or Home card) — it would touch FEAT-008's nav, which
  has just settled. Recorded as ADR-0018's first revisit trigger.
- Browser-level verification of these screens: the Chrome extension cannot load localhost
  (owner action). Everything here is proven by component tests, not by a real browser.
