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

For limits: per-(phone, client) and per-phone hourly budgets already exist (ADR-0027). Added: **daily caps — per client address across all phones (20), per (door, phone) (10), server-wide (200)** — counted in that order after every existing budget, with the same INCR+first-hit-EXPIRE script; India calendar days; keys carry NODE_ENV and live 2 days. Round lifecycle SMS are not capped (dropping them would break the product).

V2 (first round) found the original design weaker than this ADR claimed: every existing budget is per (phone, client), so ONE address with fresh numbers was limited only by the global throttler (120/min) and could spend the 200/day cap in ~2 minutes; and a per-phone key shared across doors let a stranger with no invite code lock a resident out of their society door for the day via 10 admin-door requests. Hence the per-client daily cap and the per-door phone key.

## Decision

`OTP_CODE_LENGTH = 6` in `@bulk/shared`, used by the API's generator, the verify DTOs and the web inputs. Daily caps `OTP_CLIENT_DAILY_MAX` (20), `OTP_PHONE_DAILY_MAX` (10) and `OTP_DAILY_MAX` (200), 429 `OTP_DAILY_LIMIT`.

**Residual guess risk for administrators (CHORE-022's concern):** the society door issues an administrator's own role, now on a 6-digit code. An administrator is reachable through two doors, so at most 2 × 10 codes × 5 tries = 100 guesses a day, ≈ 1 in 10,000 a day (~3.6 % a year) for a sustained, multi-address attacker — lower than ADR-0027's ~30 %/year estimate for the old design, and the per-client cap makes it need ~5+ addresses a day.

## Consequences

- Removing the role lookup also removes a DB read from every society-door request.
- The server-wide cap can still be spent by an attacker rotating ~10+ addresses with fresh numbers (sign-in denial for everyone until midnight IST). One address can no longer do it. Accepted for v1; it protects the SIM. Admin-door requests count even though non-admins are never sent a code (the request path must look the same for everyone, ADR-0027).
- A stranger can still spend one door's daily budget for a known number (10 requests from 2+ addresses); the other door is unaffected.
- Behind a reverse proxy the per-client cap needs `TRUST_PROXY` (ADR-0027), or every caller is one client.
- Codes already issued as 4 or 8 digits stop verifying at deploy (they expire within 5 minutes anyway).

**Revisit trigger:** the server cap is reached on a normal day (raise it or add a per-IP daily cap); SMS delivery problems from carrier limits; moving to a commercial SMS provider.
