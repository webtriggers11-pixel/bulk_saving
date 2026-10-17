# CHORE-020 — FEAT-014 review leftovers

**Status:** triaged · **Priority:** P3 · **Opened:** 2026-10-17 · **Found by:** FEAT-014 V2

1. Hiding a service's society panel while an offer/price save is paused offline hides the
   "queued" notice with it; the mutation still runs on reconnect, but nothing says so.
2. `OfferingControl` re-mounts on a stored-price change (its `key`), dropping unsaved
   text typed into that society's price box if another tab saves underneath it.
3. No test asserts the catalog-admin spec leaves nothing behind; deleting the
   `issuedSlugs` clause brings the leak back with all tests green (reviewer proved it).
   Candidate: a global Jest teardown that fails on any `svc-%` row it did not start with.
