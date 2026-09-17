# CHORE-002 — Dev-only: surface the OTP in a toast

**Status:** in-progress · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-18

## Why

Local end-to-end clicking is blocked on the OTP: the stub SMS adapter sends nothing,
and the code is never returned or logged by default (ADR-0007), so signing in during
development means reading it out of Redis by hand. The owner asked to "show otp in
toast" for now.

## The tension (why this isn't a one-liner)

ADR-0007 and CLAUDE.md both state the OTP is **never logged or returned**. Returning it
in the API response is exactly the thing that rule exists to prevent: if it ever ships
enabled, anyone who knows a phone number and an invite code can request a code, read it
from the response, and authenticate as that resident. This is a full auth bypass, not a
convenience bug.

So it ships as a **deliberately dev-gated leak**, not as a change to the contract
(ADR-0016):

- off unless `OTP_DEV_LOG=true` — the flag that already means "this is a local box,
  expose OTPs" (it currently controls the debug log line in the stub SMS channel);
- **and** refused whenever `NODE_ENV=production`, so the flag alone cannot do damage;
- the field is optional in the shared contract and absent — not null, not empty — in
  every non-dev response, so a client cannot come to depend on it;
- the UI labels the toast as DEV ONLY, so nobody mistakes it for a product feature.

## Scope

- `OtpRequestResponse.devCode?` in `@bulk/shared`, populated only under the guard.
- A small `Toast` primitive in `apps/web` (none existed) + the onboarding wiring.
- `.env.example` documents what the flag now does. Local `.env` flipped to `true`.

## Out of scope

- Any change to how OTPs are generated, hashed, rate-limited or verified.
- Showing the code anywhere other than the onboarding flow.
- A general app-wide toast/notification system (one primitive, one caller).

## Reversal

Delete the `devCode` field, its guard, and the toast's `devCode` branch; the flag
returns to controlling only the stub channel's debug log. Nothing else depends on it.
