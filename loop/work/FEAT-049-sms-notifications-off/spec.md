# FEAT-049 — Only OTP SMS; every other SMS off

## Why
Owner (2026-11-25): "only otp sms is req, rest all sms dont send for now comment it or off it".
The TextBee gateway is a personal SIM with limited SMS; round updates would spend it.

## Acceptance
- AC1: `SMS_NOTIFICATIONS=off` → the outbox processor sends no SMS; the row is marked SENT and the skip is logged (redacted phone).
- AC2: push fan-out still runs before the skip.
- AC3: OTP SMS (both doors) is unaffected — it never passes through the outbox.
- AC4: unset/blank = on (today's behaviour); any other value refuses to boot.
- AC5: the owner's local .env and the server's api.local.env carry `SMS_NOTIFICATIONS=off`; .env.example documents it.
