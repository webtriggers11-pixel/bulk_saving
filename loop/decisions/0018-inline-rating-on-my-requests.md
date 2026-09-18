# ADR-0018: Rating is inline on the My Requests card, with a real radiogroup and no optimistic write

**Status:** Accepted
**Date:** 2026-09-18 · **Deciders:** Vivek (autonomous authorization), agent · **Work item:** FEAT-009

## Confidence

**Level:** Medium-High
**Basis:** The placement follows from where a resident already is when they think about a
finished job — FEAT-008's My Requests card already shows the round's status and their
pledge, and already renders `myRating`. The accessibility shape (a radiogroup, not five
click-handling divs) is not a preference: it is what makes five stars operable by keyboard
and announced by a screen reader. The judgment call is skipping optimistic updates.

## Research depth

**Judgment call**, plus a read of the existing code: `MyRequestsPage.tsx`,
`components/QueryState.tsx` and `useRounds.ts` (whose `['rounds','mine']` key is a prefix
child of `['rounds']`, which decides the invalidation strategy). No external research.

## Context and problem

FEAT-007's rating API has no UI. We must decide where a resident rates, how the star input
is built, and how the write interacts with the TanStack Query cache — on a phone, on Indian
mobile data, where a failed write is normal rather than exceptional.

## Options considered

1. **Inline on the My Requests card** (chosen). Pro: zero navigation from the place the
   resident is already looking at the finished job; the card already has the round, the
   status and `myRating`; no new route, so nothing in FEAT-008's just-settled `App.tsx` or
   nav has to change. Con: the card grows a form, and a long comment field on a small card
   is cramped.
2. **A dedicated `/my-requests/:id/rate` route.** Pro: room for a richer form; a URL to
   link from an SMS later. Con: a new route in a file another session just stabilised, a
   back-navigation state problem, and a whole screen for two inputs.
3. **A modal over the list.** Pro: focus, no layout pressure. Con: this app has no modal
   primitive; introducing focus trapping and scroll locking for two inputs is a poor trade,
   and modals are the worst of the three on a small screen with a keyboard open.
4. **Rate from a round detail page.** Rejected on fact: there is no resident-facing round
   detail page, and inventing one is a bigger feature than rating.

**Star input:** a native `radiogroup` of five radios (visually stars) rather than click
handlers on spans. Rejected alternative: a `range` slider — it reads as a continuous value
and screen readers announce a number, not a rating.

**Cache:** invalidate `['rounds']` after a successful write, and do NOT write optimistically.
Rejected alternative: an optimistic cache patch. On a flaky connection an optimistic star
that silently reverts is worse than a spinner — the resident believes they rated and did
not. The server response is the only thing this UI trusts.

## Decision

Option 1, with a radiogroup star input and a non-optimistic mutation that invalidates
`['rounds']` (which covers My Requests via the key prefix). A failed submit keeps the typed
comment and stays usable. The submit control is disabled while in flight, so a double tap
cannot produce two writes. The admin surfaces show `average (count)` and say "No ratings
yet" rather than rendering `null` as `0` — a vendor nobody has rated must not look terrible.

## Consequences

Good: no new route, no new primitive, nothing in FEAT-008's files changes; one obvious
place to rate; the write is honest about failure; the star input works with a keyboard and a
screen reader.
Bad: the card carries a form, so `MyRequestsPage` grows and its tests grow with it. Without
optimism the resident waits on a round trip, which on bad data is a visible pause. No in-app
nudge, so a resident who never opens My Requests never rates — the delivered SMS is the only
prompt.

## Revisit trigger

- Ratings-per-delivered-round comes in low → add an in-app prompt (a tab badge or a Home
  card), which means touching FEAT-008's nav.
- Residents ask to rate from the SMS link → that needs the dedicated route (option 2) and a
  deep link.
- A second form of this shape appears → extract a modal primitive properly rather than
  growing more cards.
