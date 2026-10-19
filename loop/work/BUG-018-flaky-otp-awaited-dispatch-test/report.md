# BUG-018 — flaky: "DOES wait for the provider when the dispatch is awaited" hangs to its 30s timeout under the full suite

**Status:** done · **Priority:** P2 · **Opened:** 2026-10-19 · **Reporter:** agent (BUG-017 V1 gate run)

## Observed vs expected
- **Observed:** 1 failed / 462 passed in the full backend run (`jest --runInBand`); the same suite passes 24/24 alone. The test raced: `HangingChannel.finish()` released only a send that had already arrived, and under the full suite the request's Redis work exceeded the test's fixed 50ms wait, so the send arrived AFTER the release and never resolved.
- **Expected:** the test waits for the send to be in the provider's hands before asserting "not settled", and a release always applies to the next send.
- **Where:** `apps/backend/src/modules/auth/otp.service.spec.ts` (dispatch modes).

## Reproduction
- **Failing run:** BUG-017 V1 gate, 2026-10-19 22:33 IST — scratchpad `v1-bug017.log`. Timing-dependent, so no deterministic red; the fix removes the timing from the test.

## Root cause
A fixed sleep standing in for "the send has started", plus a one-shot release that could fire before anything was waiting for it. Test-only.

## Decision-log check
None — test harness; ADR-0027 (dispatch modes) unchanged.

## Fix
- `HangingChannel.called` (a promise the test awaits) and a remembered release. Test-only; `fix(BUG-018)` with the BUG-017 gate.

## Lesson
none new — the same shape as BUG-013 (a synchronous count compared against an asynchronous send).
