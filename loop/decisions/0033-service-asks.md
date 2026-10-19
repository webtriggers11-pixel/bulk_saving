# ADR-0033: Residents ask for services; an opened round answers the askers

**Status:** Accepted · **Date:** 2026-10-19 · **Deciders:** Vivek ("yes do it"), agent · **Work item:** FEAT-022
· **Builds on:** ADR-0010 (admin-opened rounds), ADR-0013 (outbox), ADR-0032 (push), ADR-0003 (tenancy)

## Confidence
**Level:** High (mechanism, tenancy, transactional notify — integration-tested) · Medium (whether
residents use it; unmeasured)

## Research depth
**Judgment call**, grounded in the repo's existing patterns (outbox staging inside the round
transaction; unique-key idempotency used for pledges).

## Decisions
1. **An ask is a row, one per resident per service** (`@@unique([residentId, serviceId])`).
   Asking twice is one ask; withdrawing deletes it. No status column: an ask that has been
   answered is deleted too, so "waiting" is simply "exists" and counts stay cheap.
2. **Answered in the round's transaction.** `createRound` stages a SERVICE_ASK_OPENED message
   per asker and deletes the asks inside the same transaction that creates the round
   (ADR-0013): no round → no message and the asks survive; a round → every asker hears once
   (dedupe key round × resident) and is dispatched after commit like every other message.
3. **Ask is the wrong verb while a round is open** → 409 ROUND_ALREADY_OPEN; the card shows
   booking instead (FEAT-021).
4. **Counts are per society** — the same service offered elsewhere has its own demand.
5. **Push deep-links the answer:** the ask-opened push goes to `/rounds?join=<id>`; the service
   worker's path allowlist admits exactly that one query shape.
6. **Admin view is a to-do list** (top 20, most asked first, oldest first on ties) with a link
   that pre-fills the New round form — not an analytics report.

## Revisit triggers
- Residents want to say HOW MANY units they would pledge → add `units` to the ask and show
  "≈ N units wanted" (helps the admin set tiers).
- Spam/abuse of asks → per-resident rate limit (today one ask per service is the bound).
