# ADR-0017: Ratings hang off the round, one per participant; the first rating flips the status

**Status:** Accepted
**Date:** 2026-09-18 · **Deciders:** Vivek (autonomous authorization), agent · **Work item:** FEAT-007

## Confidence

**Level:** Medium-High
**Basis:** The shape (a rating row per participant per round, vendor scores aggregated
through rounds) follows directly from the existing model: ADR-0012 already put the vendor
on the round, and the round is the only place that knows who was served and by whom. What
is a genuine judgment call is the `RATED` semantics — see below — and the choice to let a
resident edit a rating indefinitely. Both are cheap to change: neither is load-bearing for
anything but reporting.

## Research depth

**Judgment call.** No external research. Grounded in BRIEF.md's success metric ("delivered
jobs average ≥ 4.0 / 5") and risk R3 (vendor accountability), and in the existing
ADR-0011 transition machinery, which already has a `DELIVERED → RATED` edge and a
`markRated()` that nothing called.

## Context and problem

A resident must be able to rate a delivered job, and the admin must be able to see a
vendor's track record. We must pin: what a rating attaches to, how many a round can have,
who may write one and when, what `RATED` actually means, and how a vendor's score is
derived.

## Options considered

1. **A `Rating` row per (round, resident); vendor scores aggregated through the round**
   (chosen). Pro: one write path; the rating is always tied to the specific job and the
   vendor who did it; multi-participant rounds keep each resident's own voice; the
   existing `DELIVERED → RATED` edge is finally used. Con: a vendor's average needs a join
   through rounds rather than a column read (cheap at this scale, and always consistent).
2. **Rate the vendor directly** (`Rating` FK to `Vendor`). Pro: trivial average. Con: a
   rating floats free of the job it describes — no way to tell which round a complaint is
   about, no way to stop someone rating a vendor they never met, and the round's `RATED`
   status becomes meaningless.
3. **One rating per round** (the round is rated once, by whoever gets there first). Pro:
   simplest possible. Con: in a 12-participant round, one resident speaks for eleven
   others; the BRIEF's metric would be an average of first-movers, which is exactly the
   population most likely to be unrepresentative.
4. **Denormalise `averageRating` / `ratingCount` onto `Vendor`.** Pro: fast reads. Con: a
   second source of truth to keep in step with every insert, update and delete, for an
   admin screen that reads a handful of rows. Rejected until the join actually hurts.

## Decision

Option 1, with these rules:

- **One rating per (round, resident)**, enforced by a unique constraint and written as an
  upsert — a resident can correct a mis-tap or revise after the fact. Deleting one's own
  rating is allowed; the round does NOT return to DELIVERED.
- **Stars are an integer 1–5**; the comment is optional, trimmed, and capped at 500 chars.
- **Eligibility:** the caller must be a participant of that round, the round must be in
  their society, and its status must be DELIVERED or RATED. Anything else is refused and
  writes nothing. A non-participant gets 403 (the round is legitimately visible to their
  society), a cross-society round gets 404 (tenant isolation, ADR-0003).
- **`RATED` means "at least one resident has rated", not "all have".** Requiring everyone
  would strand rounds in DELIVERED forever — residents who never open the app are the
  norm, not the exception. The flip happens on the first rating, through
  `RoundsService.markRated()` and the guarded transition (ADR-0011): no rating code writes
  `status` itself. Subsequent ratings and edits do not re-transition.
- **Vendor and platform averages are computed on read** by aggregating ratings through
  their rounds, rounded to one decimal, `null` when there are none.

## Consequences

Good: the success metric and vendor accountability both become real numbers with one small
table; the state machine gains its missing terminal edge; every rating is attributable to a
job, a resident and a vendor.
Bad: `RATED` is a weaker claim than it reads — a round with one 5★ from twelve participants
looks identical to one with twelve; anyone reading the status must look at the count.
Vendor averages cost a join, and an editable rating means a vendor's score can move after
the admin has already acted on it.

## Revisit trigger

- The dashboard or vendor list gets slow enough that the aggregation join shows up →
  denormalise onto `Vendor` (option 4) with a scheduled recompute.
- Ops want a rating to mean "the round is finished" → introduce a distinct completion
  concept rather than overloading `RATED`.
- Anyone asks for disputes, vendor replies, or action on a low score (auto-deactivation,
  alerting) → that is a moderation feature with its own ADR, not an extension of this one.
- Editable-forever ratings cause a real argument with a vendor → add an edit window.

## Amendments

**2026-09-18 (V2, FEAT-007).** Two clarifications, no change of decision:

1. **The flip is a no-op when someone else won the race.** The rating path calls
   `RoundsService.markRatedIfDelivered()`, not `markRated()`. The status the rating
   service reads is taken WITHOUT the row lock, so two participants rating the same
   DELIVERED round simultaneously both believe they are first; the strict version threw
   409 INVALID_ROUND_TRANSITION at the loser for a rating that had in fact been saved.
   The V2 reviewer reproduced this on a live server. It is also the DESIGNED traffic
   pattern, since the delivered SMS asks every participant to rate at the same moment.
   The decision is now re-made under the lock and a round that is no longer DELIVERED
   returns null.

2. **The rating write and the status flip are deliberately NOT one transaction.** They
   are two transactions: the upsert commits, then the flip is attempted. Wrapping them
   together would be worse — a conflict would roll the resident's rating back, turning a
   cosmetic error into a lost rating. The residual exposure is narrow and self-healing:
   a crash between the two leaves a DELIVERED round that already holds a rating, every
   aggregate still counts it, and the next rating or edit on that round flips it. The
   only lasting case is a single-participant round whose sole rater never returns — one
   round stuck in DELIVERED with an accurate rating attached. Accepted.
