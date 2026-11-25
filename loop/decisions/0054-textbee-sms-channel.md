# ADR-0054: TextBee is the SMS provider behind `NotificationChannel`; WhatsApp sign-in gets an explicit off switch

**Status:** Accepted
**Date:** 2026-11-25 · **Deciders:** owner (chose TextBee) + agent · **Work item:** FEAT-046

## Confidence

**Level:** Medium
**Basis:** the request shape is the owner's working curl; behaviour on errors is unit-tested against a fake fetch. Not exercised against the live gateway by the gate (it must not send real SMS). A phone-based gateway has carrier/SIM limits (daily SMS caps, DLT rules in India for bulk traffic) that we have not measured.

## Research depth

**Depth:** Quick check — the owner's curl, the existing ADR-0007/0013/0027 channel and retry contracts.

## Context

ADR-0007 put every send behind `NotificationChannel`; v1 bound a stub. ADR-0053 deferred a real provider. The owner picked TextBee (Android SMS gateway: `POST /api/v1/gateway/send-sms`, `x-api-key`, `{deviceId, recipients, message, simSlotIndex}`), and asked to comment out WhatsApp for now.

## Options considered

1. **Config-driven factory: TextBee when key + device id are set, else the stub.** Chosen. Tests keep overriding the token; local dev without keys keeps the stub.
2. Replace the stub outright. Would make every dev box and CI need a gateway.
3. Add an SDK. TextBee is one POST; Node's `fetch` is enough — no new dependency.

## Decision

- `TextbeeSmsChannel` (fetch, 10 s `AbortSignal.timeout`) throws on non-2xx/network errors with only `HTTP <status>` or the error name and a redacted phone. On the queued paths (admin OTP door, ADR-0027; round outbox, ADR-0013) BullMQ retries it and no OTP lands in `failedReason`.
- The resident OTP door is **awaited, not queued**: a failure there blocks up to 10 s, then `OtpService` drops the stored code and answers a clean 503 `OTP_DELIVERY_FAILED` (generic message, no provider text). No automatic retry; the user taps resend (the budgets already spent stay spent). (V2 P2)
- Test runs can never bind the real channel: `test/load-env.ts` blanks both keys (blank, because ConfigModule re-reads `.env`), and `scripts/e2e-smoke.mjs` refuses to run while the backend `.env` has a TextBee key. (V2 P1/P2)
- Key and device id are both-or-neither at boot (same rule as ADR-0038's WhatsApp set).
- The dev OTP stash is kept under `devOtpEchoEnabled` so the local toast still works.
- `WHATSAPP_LOGIN=off` forces WhatsApp mode `off` (and no Cloud config) regardless of credentials or the dev echo. Commenting the `WHATSAPP_*` keys alone would only drop dev to `stub` mode, which still shows the button.

## Consequences

- With `OTP_DEV_FIXED_CODE=1111` in a dev `.env`, the real SMS says `1111`. Expected for dev.
- The API key is a secret: only in the gitignored `.env`; never in `.env.example`.
- A 2xx means TextBee queued the SMS on the phone, not that it was delivered. A timeout after TextBee accepted the send makes a queued retry send it twice. A 4xx (bad key, bad number) is retried like a 5xx. All accepted for v1.
- `.env.example` ships `WHATSAPP_LOGIN=off`, so a new developer's local WhatsApp simulator is off too; delete the line to get it back.

**Revisit trigger (mandatory):** first production launch (require the TextBee vars at boot under `NODE_ENV=production`, drop the demo server's ADR-0053 toast); any delivery failures in logs; volume beyond one phone's daily SMS cap; or WhatsApp sign-in coming back (remove `WHATSAPP_LOGIN=off`).
