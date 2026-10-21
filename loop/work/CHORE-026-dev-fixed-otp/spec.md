# CHORE-026 — OTPs are 4 digits; dev: every OTP is 1111

**Owner request (2026-10-21):** "for development use otp always 1111 for everyuser and admin"

## Acceptance
- With `OTP_DEV_FIXED_CODE=1111` and `NODE_ENV=development`, every resident and admin OTP request "sends" `1111`, and `1111` verifies.
- `NODE_ENV=test` ignores the variable, so the suites keep exercising random 6-digit codes. Unset NODE_ENV, staging and production ignore it too.
- `NODE_ENV=production` refuses to boot while the variable is set (`assertProductionSafe`).
- **Follow-up (same day): "only 4 digit"**: every OTP is 4 digits, real codes included. DTOs accept `^\d{4}$` only; the web inputs say "4-digit code", `maxLength={4}`.
- Rate limits, attempt locks and the hash-only storage are unchanged. Only the generated value differs.
