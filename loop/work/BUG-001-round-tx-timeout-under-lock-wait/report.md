# BUG-001 — Round join/update/leave returns 500 when queued > 5s behind the round row lock

**Status:** in-review · **Priority:** P1 · **Opened:** 2026-09-17 · **Reporter:** agent (FEAT-005 build/verify)

## Observed vs expected

- **Observed:** On a busy round, a join that waits more than 5s for the exclusive row lock fails with 500 ("Transaction already closed ... timeout 5000 ms"). The FEAT-003 CONCURRENCY tests flaked this way under CPU load.
- **Expected:** A queued join waits its turn and succeeds (201). The lock serializes writers, so writers should never fail just for waiting.
- **Where:** apps/backend `RoundsService` (every `$transaction` that takes `SELECT ... FOR UPDATE` on Round).

## Reproduction

- **Failing test:** `apps/backend/test/rounds.integration.spec.ts` › "BUG-001: a join queued behind a long-held round lock (> 5s) still succeeds, never 500". Another transaction holds the lock for 6.5s while a join is sent; before the fix the join got 500 (Expected 201, Received 500).
- **Reproduced on:** 2026-09-17 (deterministic; no CPU load needed).

## Root cause

Prisma interactive transactions default to `timeout: 5000`, and that clock starts before the `FOR UPDATE` lock is acquired. ADR-0004 deliberately serializes all writers on a round, so on a hot round the wait alone can exceed 5s, and Prisma then expires the transaction.

## Decision-log check

ADR-0004 (row-lock serialization) lists hot-round serialization as a known trade-off. This bug is a flaw in how that decision was implemented, not in the decision itself, so it is not superseded. The fix keeps the lock and gives lock waits enough time.

## Fix

- All round mutation transactions run through `RoundsService.inRoundTx()` with `ROUND_TX_OPTIONS = { maxWait: 5s, timeout: 30s }`.
- **Regression guard:** the test above, now green.

## Lesson

When using Prisma interactive transactions with row locks, set `timeout` explicitly, because lock-wait time counts toward it.

## Known trade-off (from V2)

A writer queued on a hot round now holds a pooled DB connection for up to 30s (previously it failed after 5s). If the number of concurrent writers on one round approaches the Prisma pool size (default: cores × 2 + 1), unrelated requests can fail with P2024 after `maxWait` (5s). This is acceptable at v1 volumes. **Revisit trigger:** P2024 errors in logs, or a round expected to see bursts of more than ~10 concurrent joins. Options then: set an explicit `connection_limit`, add `SET LOCAL lock_timeout`, or return 503 (retryable) on lock-wait expiry.
