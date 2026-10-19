# ADR-0037: The dev OTP reaches the browser through a dev-only route, never the auth response

**Status:** Accepted · **Date:** 2026-10-20 · **Deciders:** Vivek ("in dev mode otp send in toast msg in top"), agent · **Work item:** FEAT-026 · **Amends:** ADR-0020 §A (where the dev OTP affordance lives)

## Confidence
**Level:** High — the route's module is not registered outside `OTP_DEV_LOG=true` + non-production (integration-tested both ways), and the web's call sits behind `import.meta.env.DEV`, which Vite replaces with `false` in a production bundle so the code is tree-shaken out.

## Research depth
**Judgment call** on top of ADR-0020's reasoning.

## Context
ADR-0020 moved the dev OTP out of the auth response into the stub SMS channel (a log line and a 120s Redis key) because a `devCode` in the shipped auth path, behind environment checks, was an auth bypass waiting for a misconfiguration. The owner now wants the dev convenience back: the code as a toast, no Redis reading.

## Decisions
1. **The auth responses stay as ADR-0020 left them** — `{ requested: true }` and tokens only, in every environment.
2. **A separate dev route,** `GET /dev/otp?phone=…`, returns the stub channel's stashed code (`dev:last-otp:<canonical phone>`) or 404. Its MODULE is imported by `AppModule` only when `devOtpEchoEnabled()` (`OTP_DEV_LOG=true` and `NODE_ENV !== 'production'`); `assertProductionSafe` already refuses the flag in production. Elsewhere the route does not exist — a 404 like any unknown path, not a disabled handler.
3. **The web asks only from a DEV build:** the hook returns nothing unless `import.meta.env.DEV`; the production bundle contains no call. The preview on :5175 is a production build and will not show the toast — by design.
4. **The toast is honest about itself:** label "DEV ONLY", at the top of the viewport (Toast gains a `placement`), with a "Use it" action that fills the code field.

## Consequences
Good: one tap to sign in on a dev machine; two independent gates (route registration, bundle path) must BOTH be open for a code to reach a browser, and neither can be open in production.
Bad: a developer running the backend with `OTP_DEV_LOG=true` on a reachable host exposes last codes to anyone who can guess a phone — the same exposure the stub channel's log line already carries, now over HTTP. Never set the flag outside a laptop (ADR-0020's rule stands).

## Revisit trigger
If the stub channel is ever bound outside local development, remove the route rather than guard it harder.
