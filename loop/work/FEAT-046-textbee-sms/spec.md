# FEAT-046 — Real SMS through TextBee; WhatsApp sign-in switched off for now

**Status:** in-review · **Priority:** P1 · **Owner:** agent (owner request) · **Opened:** 2026-11-25

## Problem / Why

Every OTP and round message has gone to the stub channel, which only logs (ADR-0053 says it plainly: "Remove the route and wire a real SMS provider" was deferred). The owner chose TextBee (an Android phone gateway, `POST https://api.textbee.dev/api/v1/gateway/send-sms`, `x-api-key`) and asked to put it in the env and comment out the WhatsApp options for now.

## User stories

1. As a resident or admin, I get my sign-in code as a real SMS.
2. As a resident, round lifecycle messages reach my phone as SMS.
3. As the owner, I can switch WhatsApp sign-in off without deleting its credentials.

## Acceptance criteria

- [x] AC1: With `TEXTBEE_API_KEY` + `TEXTBEE_DEVICE_ID` set, `NOTIFICATION_CHANNEL` is the TextBee channel; with neither, the stub (unchanged). Exactly one set refuses to boot.
- [x] AC2: A send POSTs `{deviceId, recipients:[phone], message, simSlotIndex?}` with `x-api-key`; `TEXTBEE_SIM_SLOT` optional (0–3), `TEXTBEE_BASE_URL` optional (https).
- [x] AC3: Non-2xx, network error or a 10 s timeout throws; the queued paths (admin OTP, round outbox) retry via BullMQ, the awaited resident door answers 503 `OTP_DELIVERY_FAILED` and drops the code. No error carries the code, message body or full phone, and no provider text reaches a client.
- [x] AC4: The dev OTP stash (`dev:last-otp:<phone>`) still works under the dev echo, so the local toast keeps working.
- [x] AC5: `WHATSAPP_LOGIN=off` forces WhatsApp sign-in off (no button, start routes answer WHATSAPP_LOGIN_DISABLED) even with credentials or the dev echo. The owner's `.env` has the `WHATSAPP_*` lines commented out plus `WHATSAPP_LOGIN=off`; `.env.example` documents both.
- [x] AC6: Suites stay hermetic: `load-env.ts` blanks the TextBee keys (asserted), dev-otp overrides the channel, `wa-login` ignores a developer's `WHATSAPP_LOGIN`; `e2e-smoke.mjs` refuses to run with TextBee keys set.

## Out of scope

Delivery receipts/webhooks from TextBee; production-boot requirement for an SMS provider; the demo server's env (separate deploy step, ADR-0053 revisit); removing WhatsApp code.

## Open questions

- Should production refuse to boot without TextBee? → not now (would break the demo deploy); revisit with ADR-0053.
