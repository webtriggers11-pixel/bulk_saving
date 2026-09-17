# BUG-002 — Web (Vitest/RTL) tests time out when the machine is CPU-saturated

**Status:** done · **Priority:** P2 · **Opened:** 2026-09-17 · **Reporter:** agent (FEAT-005 verify)

## Observed vs expected

- **Observed:** `verify.sh` failed with 10 web tests at "Test timed out in 5000ms" or "Unable to find ..." after RTL's 1s default wait. These included long-standing tests (App, OnboardingPage, RoundsPage), and the same tests pass when run on their own. Load average was 60–90 on 8 cores, from backend Jest running in parallel plus unrelated processes on the machine.
- **Expected:** a correct test suite passes whatever the CPU load; timeouts should catch hangs, not slowness.

## Reproduction

- **Failing test:** not reproducible without load. Evidence: the FEAT-005 verify log (10 failures, all timing, no assertion mismatches). It flaked the same way across three builder runs.
- **Reproduced on:** 2026-09-17.

## Root cause

1. `pnpm -r test` runs backend Jest (real DB, Redis, Nest boot) and web Vitest at the same time, so each starves the other.
2. Vitest's 5s test timeout and RTL's 1s `asyncUtilTimeout` are tuned for an idle machine.

## Decision-log check

No ADR is involved. This is test-harness tuning only.

## Fix

- `scripts/verify.sh`: `pnpm -r --workspace-concurrency=1 test`.
- `apps/web/vite.config.ts`: `testTimeout`/`hookTimeout` 20s. `src/test/setup.ts`: RTL `asyncUtilTimeout` 5s.
- **Regression guard:** V3 double run on this machine.

## Lesson

none
