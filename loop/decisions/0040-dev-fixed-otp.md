# ADR-0040: Residents' OTPs are 4 digits, an administrator's 8; a fixed dev OTP (`OTP_DEV_FIXED_CODE`), development only

**Status:** Accepted · **Date:** 2026-10-21 · **Deciders:** Vivek ("for development use otp always 1111 for everyuser and admin", then "only 4 digit", then option B: "4 for residents, 6–8 for admin"), agent · **Work item:** CHORE-026 · **Amends:** ADR-0007 (OTP length 6 → 4 / 8) · **Resolves:** CHORE-022 option 1, ADR-0020, ADR-0037 (dev OTP affordances)

## Confidence
**Level:** High for the dev gate and the admin length. Med for 4-digit resident codes: an owner product call that trades guess space for convenience, with the ADR-0027 budgets carrying the risk. One generation site (`OtpService.request`) serves both doors. The gate is unit-tested for every NODE_ENV, and production refuses the variable at boot.

## Research depth
**Judgment call.**

## Context
ADR-0037 sends the dev OTP to the browser as a toast. The owner wants something simpler: one known code for everyone on a dev machine, with no toast or log lookup.

## Decisions
0. **Residents' OTPs are 4 digits; an administrator's number gets 8** (owner chose B, after seeing the numbers). On 4 digits, ADR-0027's ~40 guesses an hour at a SUPER_ADMIN would be about 94% exposure a month. On 8 digits it is about 0.35% a year, which is CHORE-022's option 1. A resident (one door, about 20 guesses an hour) on 4 digits is exposed to roughly 76% a month under a sustained attack. That is the owner's accepted trade for a resident account, which holds pledges, not admin powers.
   - The admin door sends 8 digits to EVERY caller, with no role lookup on that path (ADR-0023 and CHORE-017 unchanged).
   - The society door issues the account's own role, so it asks `isAdminPhone` for every caller and sends 8 digits to an administrator's number. The response is identical either way; only the SMS, which goes to the number's owner, differs.
   - Both doors' DTOs accept `^(\d{4}|\d{8})$`, so the format check reveals nothing about whose number it is.
1. When `OTP_DEV_FIXED_CODE` (exactly 4 digits; it wins over the admin length too) is set AND `NODE_ENV` is exactly `development`, `OtpService.request` uses it instead of a random code. The value is still stored only as an HMAC, and every budget, lock and TTL still applies.
1a. In development, `verify` accepts the fixed code even when no OTP is outstanding (none requested, TTL passed, or already used), so it never answers "expired" for `1111` (owner: "That code has expired… fix this"). Any outstanding OTP is consumed. The account checks after verify (society membership, admin role) are unchanged.
2. It does NOT apply under `test`. The suites keep random codes, so no test can pass by accident on a guessable code. Unset NODE_ENV, or any other value, also means off (default closed).
3. `assertProductionSafe` refuses any non-empty value in production.
4. Web: the resident input reads "4-digit code" with `maxLength={8}`, because an administrator on that door types 8. The admin input reads "8-digit code" with `maxLength={8}`.

## Consequences
Good: sign in as any resident or admin locally with `1111`.
Bad: a dev database reached from outside with this flag on is open to anyone who knows the code. Keep it on laptops (the ADR-0020 rule stands).

## Revisit trigger
If a shared dev/staging environment ever runs with `NODE_ENV=development`, drop the flag there. If guessing shows up in the verify-fail counters, raise `OTP_LENGTH` to 6 (one constant, plus the DTO and the label). CHORE-022's option 3 (alert on a LOCKED budget for a SUPER_ADMIN) is still open.
