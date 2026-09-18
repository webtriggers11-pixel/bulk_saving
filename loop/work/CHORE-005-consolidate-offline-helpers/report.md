# CHORE-005 — One offline rule, one place: resident views adopt `lib/offline.ts`

**Status:** done · **Priority:** P2 · **Opened:** 2026-09-18 · **Reporter:** agent (parallel session, after BUG-004)

## Why

Two sessions found the same TanStack Query pausing behaviour hours apart and each
wrote its own helpers for it:

- FEAT-008 (this session) — `hasQueryFailed()` / `hasUsableData()` exported from
  `apps/web/src/components/QueryState.tsx`, used by the three resident data views.
- BUG-004 (parallel session) — `queryStalled()` / `hasRows()` / `anyPaused()` plus
  the copy as constants, in `apps/web/src/lib/offline.ts`, used by the fifteen-odd
  admin controls and by FEAT-009's rating control.

Same rule, two names, two files. That is precisely the drift `lib/offline.ts` was
created to prevent, and the next person to touch an offline state will copy
whichever one they happen to find. One of them has to go.

`lib/offline.ts` wins: it is a lib rather than an export hanging off a
presentational component, it covers mutations as well as queries, and it owns the
copy so the wording cannot diverge across controls. Nothing about the FEAT-008
version is better except that it was written first.

## Scope

- Resident views (`HomePage`, `ServicesPage`, `RoundsPage`) import from
  `lib/offline.ts`; `hasQueryFailed` / `hasUsableData` are deleted from
  `QueryState.tsx`, which goes back to being purely presentational.
- `RoundsPage`'s pledge controls use `anyPaused()` and the shared copy constants
  instead of their own `isPaused` expression and inline string.
- **One real difference to handle:** `hasRows()` is array-only, while
  `hasUsableData()` also accepted a single object. `HomePage`'s query returns one
  `{ resident, society }` object, so it cannot use `hasRows` — it checks `data`
  directly, which is what it means anyway.
- Behaviour must not change. Same tests, same assertions, no new ACs.

## Also taken (handed over by the parallel session)

`MyRequestsPage.tsx` had the rule inline — its own `isError || fetchStatus === 'paused'`
and `Boolean(data && data.length > 0)` with the reasoning copied into comments. It
now imports both from `lib/offline.ts`. That file was committed by the other session,
which asked for it to come here rather than be handed back, and it was the clearest
example of the problem: three copies of one rule, all correct, none of them shared.

## On which helper survived

The parallel session offered `hasUsableData()` as the more general survivor, since
`hasRows()` is array-only. Kept `hasRows()` anyway: the survivor that matters is the
LOCATION (`lib/offline.ts` — a lib, covering mutations as well as queries, owning the
copy), not the signature. A caller holding a single object should say `data !== undefined`
at the call site, as `HomePage` now does; a general predicate that quietly accepts both
shapes hides which one a page actually has.

## Out of scope

- The admin controls and the rating control (already on `lib/offline.ts`).
- Any change to the copy — this is a consolidation, not a rewrite. If the wording
  should change, that is its own item.
