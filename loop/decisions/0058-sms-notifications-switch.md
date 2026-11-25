# ADR-0058: `SMS_NOTIFICATIONS=off` stops every non-OTP SMS at the outbox processor

**Status:** Accepted
**Date:** 2026-11-25 · **Deciders:** owner (asked for it) + agent · **Work item:** FEAT-049

## Confidence

**Level:** High
**Basis:** the outbox processor is the ONLY place a non-OTP message reaches `NotificationChannel` (ADR-0013); OTPs call `sendOtp` directly. Covered by an integration test.

## Research depth

**Depth:** Quick check — every `NotificationChannel` caller was listed (`otp.service`, `otp-send.processor`: `sendOtp`; `notification-dispatch.processor`: `send`).

## Context

SMS goes out from a personal SIM through TextBee (ADR-0054). The owner wants only sign-in codes texted for now.

## Options considered

1. **Switch in the outbox processor** — one place, push still fans out, rows still finish. Chosen.
2. **Make `TextbeeSmsChannel.send` a no-op** — hides the decision inside one provider; the stub and any future provider would still send.
3. **Stop staging notifications** — loses the in-app record and push.

## Decision

Option 1. `SMS_NOTIFICATIONS=off` (only `off`, or unset/blank = on). With it off the processor runs push fan-out, then marks the row SENT without calling `channel.send`, logs the skip with a redacted phone, and returns `{ sent: true, smsSkipped: true }`.

## Consequences

- SENT now means "handled" when the switch is off; the log line says the SMS was skipped. No migration (no new status).
- Rows staged while off are not re-sent when the switch is turned back on.
- Tests blank the key (`test/load-env.ts`) so an owner `.env` with `off` cannot change the outbox suites.

## Revisit trigger

A registered SMS provider (DLT) replaces the personal SIM → turn the switch back on, or remove it.
