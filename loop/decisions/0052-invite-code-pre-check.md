# ADR-0052: Check the invite code in its own endpoint, with wrong guesses budgeted per client

**Status:** Accepted
**Date:** 2026-11-24 · **Deciders:** agent (autonomous, owner standing direction) · **Work item:** FEAT-045

## Confidence

**Level:** Medium
**Basis:** follows the patterns this codebase already uses (ADR-0007/0027 Redis counters, ADR-0045 inactive = unknown). The budget number (20 misses/hour) is a guess, made without production traffic.

## Research depth

**Depth:** Judgment call

**Sources:** none outside the repo (ADR-0007, ADR-0027, ADR-0045).

## Context and problem

The owner wants the invite step to refuse a wrong code before the resident moves on. Until now the only server check happened at the OTP / WhatsApp doors, which need a phone number or a WhatsApp start first.

## Options considered

1. **`POST /auth/invite/check` → `{ valid: true }` / 400 INVALID_INVITE_CODE, failures budgeted per IP bucket (20/hour)** — the resident gets the error on the right screen. The budget caps guessing, and valid checks are free, so a society's residents who sign in from one shared wifi are never blocked.
2. **Call `/auth/otp/request` early** — it needs a phone number, and it would send an SMS.
3. **Return the society's name as well** — friendlier ("Joining Green Meadows"), but it hands society names to anyone guessing codes. Rejected; can be revisited if the owner asks.
4. **Rely only on the global throttler (120/min)** — too loose to cap guessing.

## Decision

Option 1. The check runs through `SocietiesService.findByInviteCode`, so an inactive society's code is "invalid" too. The OTP and WhatsApp doors keep their own checks (the client is never trusted, ADR-0003).

## Consequences

- One more unauthenticated endpoint. It reveals only what `/auth/otp/request` already revealed (code validity), and more slowly.
- Residents behind one NAT who mistype 20 times in an hour wait up to an hour to check; the OTP door does not depend on this budget.

**Revisit trigger:** production logs show real users hitting `INVITE_CHECK_RATE_LIMITED`, or guessing traffic shows up on this route.
