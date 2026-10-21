# ADR-0040: A fixed dev OTP (`OTP_DEV_FIXED_CODE`), development only

**Status:** Accepted · **Date:** 2026-10-21 · **Deciders:** Vivek ("for development use otp always 1111 for everyuser and admin"), agent · **Work item:** CHORE-026 · **Amends:** ADR-0020, ADR-0037 (dev OTP affordances)

## Confidence
**Level:** High. One generation site (`OtpService.request`) serves both doors. The gate is unit-tested for every NODE_ENV, and production refuses the variable at boot.

## Research depth
**Judgment call.**

## Context
ADR-0037 sends the dev OTP to the browser as a toast. The owner wants something simpler: one known code for everyone on a dev machine, with no toast or log lookup.

## Decisions
1. When `OTP_DEV_FIXED_CODE` (4–6 digits) is set AND `NODE_ENV` is exactly `development`, `OtpService.request` uses it instead of a random code. The value is still stored only as an HMAC, and every budget, lock and TTL still applies.
2. It does NOT apply under `test`. The suites keep random codes, so no test can pass by accident on a guessable code. Unset NODE_ENV, or any other value, also means off (default closed).
3. `assertProductionSafe` refuses any non-empty value in production.
4. The verify DTOs accept `^\d{4,6}$`. In production a 4-digit guess can only hash-mismatch, and each guess spends the same budget.

## Consequences
Good: sign in as any resident or admin locally with `1111`.
Bad: a dev database reached from outside with this flag on is open to anyone who knows the code. Keep it on laptops (the ADR-0020 rule stands).

## Revisit trigger
If a shared dev/staging environment ever runs with `NODE_ENV=development`, drop the flag there.
