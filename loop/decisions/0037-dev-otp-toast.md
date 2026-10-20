# ADR-0037: The dev OTP reaches the browser through a dev-only route, never the auth response

**Status:** Accepted · **Date:** 2026-10-20 · **Deciders:** Vivek ("in dev mode otp send in toast msg in top"), agent · **Work item:** FEAT-026 · **Amends:** ADR-0020 §A (where the dev OTP affordance lives)

## Confidence
**Level:** High — the route's module is registered only under `OTP_DEV_LOG=true` AND an explicit `NODE_ENV` of `development`/`test` (unit-tested for every combination, default CLOSED when NODE_ENV is unset; V2 P2), and the web reaches the fetch only through a dynamic `import()` behind a build-time constant — CHECKED, not believed: `scripts/check-dev-only.mjs` fails the gate if `dev/otp` or `fetchDevOtp` appears in any built asset (the first version folded the constant inside a helper and shipped an inert dead branch; V2 P1).

## Research depth
**Judgment call** on top of ADR-0020's reasoning.

## Context
ADR-0020 moved the dev OTP out of the auth response into the stub SMS channel (a log line and a 120s Redis key) because a `devCode` in the shipped auth path, behind environment checks, was an auth bypass waiting for a misconfiguration. The owner now wants the dev convenience back: the code as a toast, no Redis reading.

## Decisions
1. **The auth responses stay as ADR-0020 left them** — `{ requested: true }` and tokens only, in every environment.
2. **A separate dev route,** `GET /dev/otp?phone=…`, returns the stub channel's stashed code (`dev:last-otp:<canonical phone>`) or 404, to loopback callers only. Its MODULE is imported by `AppModule` only when `devOtpEchoEnabled()` — `OTP_DEV_LOG=true` AND `NODE_ENV` explicitly `development` or `test` (an unset NODE_ENV is not development); `assertProductionSafe` additionally refuses the flag in production. Elsewhere the route does not exist — a 404 like any unknown path, not a disabled handler.
3. **The web asks only from a DEV build:** the hook returns nothing unless `import.meta.env.DEV`; the production bundle contains no call. The preview on :5175 is a production build and will not show the toast — by design.
4. **The toast is honest about itself:** label "DEV ONLY", at the top of the viewport (Toast gains a `placement`), with a "Use it" action that fills the code field.

## Consequences
Good: one tap to sign in on a dev machine; two independent gates (route registration, bundle path) must BOTH be open for a code to reach a browser, and neither can be open in production.
Bad: Nest binds every interface and CORS stops browsers, not curl — so the route answers loopback only (127.0.0.1 / ::1; 403 otherwise); on-device LAN testing uses the production preview, which has no toast. The stub channel's log line and Redis stash remain the developer's business. Never set the flag outside a laptop (ADR-0020's rule stands).

## Revisit trigger
If the stub channel is ever bound outside local development, remove the route rather than guard it harder.
