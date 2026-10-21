# ADR-0040: OTPs are 4 digits; a fixed dev OTP (`OTP_DEV_FIXED_CODE`), development only

**Status:** Accepted · **Date:** 2026-10-21 · **Deciders:** Vivek ("for development use otp always 1111 for everyuser and admin", then "only 4 digit"), agent · **Work item:** CHORE-026 · **Amends:** ADR-0007 (OTP length 6 → 4), ADR-0020, ADR-0037 (dev OTP affordances)

## Confidence
**Level:** High for the dev gate, Med for the 4-digit length (an owner product call that trades guess space for convenience; the budgets carry the risk). One generation site (`OtpService.request`) serves both doors. The gate is unit-tested for every NODE_ENV, and production refuses the variable at boot.

## Research depth
**Judgment call.**

## Context
ADR-0037 sends the dev OTP to the browser as a toast. The owner wants something simpler: one known code for everyone on a dev machine, with no toast or log lookup.

## Decisions
0. **Every OTP is 4 digits** (owner: "only 4 digit"), real codes included: `randomInt(0, 10_000)`, zero-padded. A blind guess now has a 1-in-10,000 chance instead of 1-in-a-million. ADR-0027's budgets are unchanged (5 attempts per code, then the per-client and per-phone hourly fail caps, then the resend caps), so a targeted phone still sees only a few dozen guesses an hour at most. That is a deliberate trade for a shorter code, common for SMS OTP in India.
1. When `OTP_DEV_FIXED_CODE` (exactly 4 digits) is set AND `NODE_ENV` is exactly `development`, `OtpService.request` uses it instead of a random code. The value is still stored only as an HMAC, and every budget, lock and TTL still applies.
1a. In development, `verify` accepts the fixed code even when no OTP is outstanding (none requested, TTL passed, or already used), so it never answers "expired" for `1111` (owner: "That code has expired… fix this"). Any outstanding OTP is consumed. The account checks after verify (society membership, admin role) are unchanged.
2. It does NOT apply under `test`. The suites keep random codes, so no test can pass by accident on a guessable code. Unset NODE_ENV, or any other value, also means off (default closed).
3. `assertProductionSafe` refuses any non-empty value in production.
4. The verify DTOs accept `^\d{4}$` only. The web inputs read "4-digit code" with `maxLength={4}`.

## Consequences
Good: sign in as any resident or admin locally with `1111`.
Bad: a dev database reached from outside with this flag on is open to anyone who knows the code. Keep it on laptops (the ADR-0020 rule stands).

## Revisit trigger
If a shared dev/staging environment ever runs with `NODE_ENV=development`, drop the flag there. If OTP-guessing shows up in the verify-fail counters, go back to 6 digits (a one-constant change plus the DTO and the web labels).
