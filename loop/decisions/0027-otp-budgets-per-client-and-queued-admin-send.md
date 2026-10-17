# ADR-0027: OTP budgets are per client under a per-phone ceiling; the admin door's send goes through a queue

**Status:** Accepted — supersedes parts of ADR-0023 ("What this costs": the detached send)
**Date:** 2026-10-17 · **Deciders:** Vivek ("fix", on a list naming CHORE-016 and CHORE-017), agent · **Work items:** CHORE-016, CHORE-017

## Confidence

**Level:** Medium
**Basis:** The mechanisms are standard and tested (Redis counters, BullMQ, AES-GCM). The
Medium is about policy numbers (5 per client, 10 per phone per hour) chosen without
production traffic, and about deployments that forget `TRUST_PROXY`.

## Research depth

**Judgment call**, built on the analysis already in the CHORE-016 / CHORE-017 specs and
ADR-0023's four review rounds.

## Context

- **CHORE-016:** six unauthenticated requests denied an administrator their own sign-in for
  an hour: every OTP budget was keyed by phone alone, and each request replaced the code.
- **CHORE-017:** the admin door's SMS send ran in the request process. Four review rounds
  closed four ways that leaked "this number is an administrator" (limiter state, stored
  state, response time, a synchronous throw). The residual: the deferred send still ran on
  the shared event loop, and a send in flight was lost on shutdown.

## Options considered (CHORE-016)

1. **Per-(phone, client) budgets + a per-phone ceiling, identical for every caller** — chosen.
2. A higher budget for administrators — rejected: a budget that differs by role is an
   oracle (ADR-0023's whole point).
3. Keep several codes valid so a resend does not invalidate the owner's — rejected for now:
   more live codes multiply a brute-forcer's odds per guess.

## Options considered (CHORE-017)

1. **Queue the admin door's send for EVERY caller; the worker decides** — chosen.
2. Queue only for administrators — rejected: the enqueue itself (a Redis round-trip) would
   then happen for administrators only — the timing oracle again, one step out.
3. Persist OTPs in the Postgres outbox (ADR-0013) — rejected: an OTP row is a stored
   credential, which ADR-0013 forbids.

## Decision

- **Budgets** (`OtpService.request`, both doors): 1 per 30 s and 5 per hour per
  (scope, phone, client); 10 per hour per (scope, phone) across all clients, counted only
  for requests the per-client budgets let through. A client is its IP: IPv4 as is,
  IPv4-mapped as IPv4, IPv6 by /64 (one subscriber routinely holds a whole /64); a missing
  address is one shared bucket — the old per-phone behaviour, never "no limit".
- **`TRUST_PROXY`** (bootstrap): a hop count or a list of proxy addresses, so the client is
  the real caller behind a reverse proxy. `true` is refused at boot — it would let any
  client name itself in X-Forwarded-For. Unset = socket address.
- **Admin door send**: `dispatch: 'queued'` for every caller. The request generates and
  stores the code and enqueues `{ door, phone, sealed }`; it never asks whether the number
  is an administrator. `OtpSendProcessor` asks, after the response is gone, and sends or
  drops. The code is sealed with AES-256-GCM under a key derived from OTP_HASH_SECRET
  (`otp-seal.ts`); jobs are `removeOnComplete` and `removeOnFail: true`; provider errors
  are rethrown with the code redacted, because BullMQ stores `failedReason` in Redis.
- **The resident door keeps its awaited send**: its latency varies only with invite-code
  validity, which its 400/200 already discloses, and an awaited send is what makes a
  provider outage visible to residents at all.
- **Queue namespace**: `BULLMQ_PREFIX` (default `bull`); the test suite pins `bull-test`.
  Found while building this: a `nest start --watch` dev server on the same Redis was
  consuming the suite's jobs.

## Consequences

- One machine can no longer lock an owner out. A **multi-IP attacker still can**: 10
  requests across ≥2 addresses spend the per-phone ceiling for an hour. That is the price
  of capping SMS cost and guesses; per-IP limits are not a defence against a botnet.
- **Brute force**: a multi-IP attacker gets up to 10 codes/hour × 5 guesses = 50 guesses
  per hour per phone, against 25 before (single-IP attackers are unchanged at 25). Odds
  per hour ≈ 5×10⁻⁵. Accepted; revisit trigger below.
- The admin door's request path is now identical for every caller in every phase. The
  worker still shares the process (and event loop) with the API in v1; running workers as
  a separate process removes that last residual and needs no code change.
- A queued send survives a restart (ADR-0023's "lost on shutdown" is gone); delivery is
  now worker latency, normally milliseconds. Ordering is unchanged: a later request still
  replaces the stored code, so an earlier SMS may not verify.
- Deployments behind a proxy MUST set `TRUST_PROXY` (DEPLOY.md), or every caller is one
  client — which degrades to the old per-phone behaviour, not worse.

## Revisit triggers

- Any admin reports being locked out → per-phone ceiling too low, or a botnet: add a
  CAPTCHA-free proof (e.g. a signed device token) rather than raising limits.
- OTP verify failures per phone per hour exceed ~30 in logs → add a per-phone failed-verify
  budget.
- Production traffic on the API process: move BullMQ workers to their own process.
