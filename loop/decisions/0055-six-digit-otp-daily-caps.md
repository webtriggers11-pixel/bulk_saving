# ADR-0055: One 6-digit OTP for every role and door; daily OTP caps per phone and server-wide

**Status:** Accepted (supersedes ADR-0040's lengths — 4 for residents, 8 for administrators; ADR-0040's dev fixed code stays, now 6 digits)
**Date:** 2026-11-25 · **Deciders:** owner (chose 6 digits, daily caps, local production) + agent · **Work item:** FEAT-047

## Confidence

**Level:** High for the length (industry standard, simple); Medium for the cap values (200/day total, 10/day per phone are guesses at one SIM's safe volume, not measured).

## Research depth

**Depth:** Quick check — existing limits (ADR-0027), ADR-0040's reasoning for 8-digit admin codes, FEAT-046's gateway.

## Context

ADR-0040 gave residents 4 digits ("only 4 digit") and administrators 8, because the society door issues the account's role and a 4-digit code would be a weak way into SUPER_ADMIN; that needed a role lookup on the society door. Real SMS (ADR-0054) now goes from one Android phone's SIM, which has daily limits and can be carrier-blocked for bursts.

## Options considered

1. **6 digits for everyone.** Chosen by the owner. With the 5-try lock (ADR-0007) and the per-door guess budgets (ADR-0027), ~1 in 200,000 per code — enough for administrators, so no role lookup is needed.
2. 4 for everyone — too weak for admins (1 in 2,000). 3. 8 for everyone — slow to type.

For limits: per-phone + per-client hourly budgets already exist (ADR-0027). Added: **daily caps, per phone across doors and server-wide**, counted after every existing budget, using the same INCR+first-hit-EXPIRE script; India calendar days; keys live 2 days. Round lifecycle SMS are not capped (dropping them would break the product).

## Decision

`OTP_CODE_LENGTH = 6` in `@bulk/shared`, used by the API's generator, the verify DTOs and the web inputs. Daily caps `OTP_PHONE_DAILY_MAX` (10) and `OTP_DAILY_MAX` (200), 429 `OTP_DAILY_LIMIT`. The total key carries NODE_ENV so test runs never spend a dev server's budget on the shared Redis.

## Consequences

- Removing the role lookup also removes a DB read from every society-door request.
- The server-wide cap can be spent by anyone requesting codes for many numbers (sign-in denial for the day). Per-client budgets slow that, but don't stop a rotating attacker. Accepted for v1; it protects the SIM. Admin-door requests count even though non-admins are never sent a code (the request path must look the same for everyone, ADR-0027).
- Codes already issued as 4 or 8 digits stop verifying at deploy (they expire within 5 minutes anyway).

**Revisit trigger:** the server cap is reached on a normal day (raise it or add a per-IP daily cap); SMS delivery problems from carrier limits; moving to a commercial SMS provider.
