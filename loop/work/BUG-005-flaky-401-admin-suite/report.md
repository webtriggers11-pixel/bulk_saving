# BUG-005 — Rare 401 in the admin integration suite (V3 flake)

**Status:** triaged (not reproduced on demand) · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-18

## Why this exists

FEAT-010's **V3 double run failed its flake check**: run 1 exit 1, run 2 exit 0, on a clean
tree with no dev server running. CLAUDE.md rule 5 says different results between back-to-back
runs = a flaky test = a BUG to triage, and the work item cannot close. FEAT-010 is therefore
**still open**.

## Exact signature

```
● Super-admin dashboard API (integration) › POST /admin/rounds/:id/assign
    › from CLOSED_EXPIRED → 409 INVALID_ROUND_TRANSITION with nothing written
  expected 409 "Conflict", got 401 "Unauthorized"
  at test/admin-dashboard.integration.spec.ts:328
```

One test, one run. The suite passed in the immediately following run and in **three further
full backend runs** (311/311 each). Frequency today: **1 failure in ~9 full runs.**

## What the 401 rules out

`AccessTokenGuard` → `AuthService.verifyAccessToken` does **nothing but verify the JWT** —
no DB read, no Redis read. So this is not a deleted fixture, not a cascade from another
suite's cleanup, and not a role problem (that would be 403). The token itself failed
verification.

Checked and ruled out:

- **Token expiry by TTL** — `JWT_ACCESS_TTL_SECONDS=900` in `.env`, and `accessTtlSeconds`
  defaults to 15 min; a full suite run takes ~30 s.
- **Secret mutation** — nothing anywhere assigns `process.env.JWT_ACCESS_SECRET`.
- **Fake timers** — no `useFakeTimers` / `setSystemTime` anywhere in the backend.
- **Broad deletes** — every test `deleteMany` is scoped to ids it created.
- **A competing dev server** — none was running for this V3 (that was a *different*
  interference, diagnosed and logged separately: a `nest start --watch` backend on :3100
  whose reconcilers and BullMQ workers fight the suite over the shared DB/Redis).

## Remaining hypotheses, both unproven

1. **Host clock jump.** A >900 s NTP correction between `issueTokens` (in `beforeAll`) and
   the request would make a valid token read as expired, and would hit exactly one
   in-flight suite. Fits the rarity and the signature.
2. **Cross-suite `process.env` replacement.** `cors.integration.spec.ts` does
   `process.env = { ...originalEnv }` in `afterEach`, replacing the env object rather than
   mutating it. Files share a worker process, so a snapshot taken at one file's load could
   in principle interact badly with another file's later reads. Not demonstrated, but it is
   the only remaining global-state mutation in the suite.

## How to investigate next

- Log `iat`/`exp` and `Date.now()` when a 401 is thrown under `NODE_ENV=test`, so the next
  occurrence proves or kills hypothesis 1 immediately.
- Replace the `process.env = {...}` reassignment in `cors.integration.spec.ts` with targeted
  `delete` / assignment, which is correct regardless and removes hypothesis 2.
- The structural fix is the long-open FEAT-004 P2: a **dedicated test DB and Redis**, so
  suites stop sharing mutable global state at all.

## Not doing now

Chasing a 1-in-9 flake with no reproduction is open-ended. It is registered, the signature is
recorded precisely enough to recognise on sight, and FEAT-010 stays open until a V3 double
run is clean.
