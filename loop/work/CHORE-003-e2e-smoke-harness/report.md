# CHORE-003 — Live end-to-end smoke harness

**Status:** done · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-18 · **Closed:** 2026-09-18

## Why

The owner asked for the whole application to be exercised end to end with dummy data.
`scripts/verify.sh` deliberately cannot do that: backend tests drive Nest **in-process**
via supertest, so bootstrap, the global wiring, CORS, the real HTTP stack and the queues
are never exercised as an assembled system. A green suite and a working product are not
the same claim.

## What

`scripts/e2e-smoke.mjs` — plain Node (global `fetch`), **no new dependency**. It drives the
real HTTP API of a running server as a resident and as the super-admin: onboarding and OTP,
the catalog, the full round lifecycle (open → join ×2 → tier unlock → close MET → vendor
assign → payment → deliver), illegal-transition refusals, tenant isolation, rating
(including the DELIVERED → RATED flip, revision and withdrawal), and the dashboard
aggregates. Each run uses a unique fixture suffix; it asserts **deltas**, never
platform-wide absolutes, because the dev DB accumulates.

It logs in without touching Redis by using the CHORE-002 dev OTP echo, so it needs the
server started with `OTP_DEV_LOG=true`.

Usage: `node scripts/e2e-smoke.mjs [baseUrl]` (default `http://localhost:3100`).
Exit 0 = every check passed.

## Result

76/76 checks across 11 scenarios against a live server on 3100.

**No application bugs found.** The six failures in the first run were all defects in the
harness's own assumptions — `/catalog` not `/services`, offerings are
`PUT /admin/societies/:societyId/offerings/:serviceId`, and a consumed OTP correctly
reports `OTP_EXPIRED` rather than `OTP_INVALID`. Worth recording: the product behaved
correctly in every case where the test was wrong.

## Not done

Browser-level E2E. The Claude-in-Chrome extension could not load ANY localhost page
(including the other session's dev server), so it is an extension site-permission issue,
not an application one. The resident UI is still covered only by Vitest component tests.
