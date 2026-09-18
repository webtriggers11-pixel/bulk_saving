# ADR-0016: "My Requests" gets its own route on `GET /rounds/mine` — superseding the routing clause of ADR-0015

**Status:** Accepted · supersedes the "My Requests" clause of ADR-0015 (that ADR otherwise stands)
**Date:** 2026-09-18 · **Deciders:** agent (autonomous) · **Work item:** FEAT-008

## Confidence

**Level:** High
**Basis:** Not a judgment call this time — the endpoint's behaviour was read from
the FEAT-007 work that shipped it and from the shared contract, and the round
lifecycle it has to display is fixed by ADR-0011. The failure mode being fixed is
not a preference: an OPEN-only list provably cannot show a closed round.

## Research depth

**Quick check**

**Sources:**
- `packages/shared/src/index.ts` — `MyRoundDto extends RoundDto` with
  `myRating: RatingDto | null`; `RoundStatus` union (seven members).
- FEAT-007 (parallel session, closed 2026-09-18) — `GET /rounds/mine` returns the
  caller's joined rounds in ANY status, newest first, tenant-scoped like every
  resident read. Flagged to this session by that session directly.
- `apps/backend` rounds controller — `GET /rounds` is OPEN-only, which is what
  made the ADR-0015 clause wrong.

## Context and problem

ADR-0015 decided that BRIEF's "My Requests" tab would point at the existing
`/rounds` page, adding no new route and no new data view. That was written
without checking what `GET /rounds` returns.

It returns OPEN rounds only. So a resident who joined a round would watch it
disappear from "My Requests" the moment it closed — at exactly the point they
most want to look: did enough neighbours join, was a vendor booked, when is it
happening. BRIEF is explicit that the tab means "rounds I've joined **+ their
status**", and status is mostly post-close.

The parallel FEAT-007 session then shipped `GET /rounds/mine` (joined rounds, any
status, with `myRating`) and told this session about it, which is how the mistake
surfaced before review rather than after launch.

## Options considered

1. **A `/my-requests` route reading `GET /rounds/mine` (chosen)** — the tab means
   what BRIEF says it means. Costs one route, one page, one query hook.
2. **Keep pointing at `/rounds` and relabel the tab** ("Group buys") — cheap and
   honest about what the page shows, but it silently drops a feature BRIEF asks
   for, and leaves a resident with no way to see a round they joined.
3. **Filter `/rounds` client-side to `myUnits > 0`** — rejected: the list it
   filters is already OPEN-only, so the closed rounds are not in the payload to
   filter. It would look like a fix and change nothing.

## Decision

`/my-requests` is its own route in the shell's tab bar, backed by
`useMyRounds()` → `GET /rounds/mine`. It shows every joined round with its
pledge, the live price, a resident-language line for each lifecycle state, and
the resident's own rating when one exists. `/rounds` keeps its browse role,
reachable from Home and from the My Requests empty state.

## Consequences

- Good: the tab matches BRIEF, and a closed, cancelled or delivered round stays
  visible with an explanation of what happened.
- Good: `myRoundsQueryKey` is `['rounds','mine']`, a prefix child of
  `['rounds']`, so the existing pledge mutations already refresh it without a
  second invalidation (verified against TanStack Query v5 prefix matching by V2).
- Bad: two round lists now exist, and a resident can reach the same round from
  either. Acceptable — they answer different questions ("what can I join?" vs
  "what did I join?").
- Bad: one more polled query on the same 20s cadence.

## Revisit trigger

- If Home is ever reworked to be the rounds list BRIEF describes ("active rounds
  for my society"), the `/rounds` browse page and Home merge, and this tab
  structure should be re-examined as a whole.
- If a third round list appears, promote the query keys to
  `['rounds','list']` / `['rounds','mine']` rather than letting `['rounds']`
  serve as both a concrete key and a namespace.

## Lesson

ADR-0015 stated this clause as if it followed from the caching decision it was
really about. A decision smuggled into an ADR about something else gets none of
the scrutiny the template exists to force — no options, no sources, no
confidence of its own. One `grep` of the rounds controller would have caught it.
