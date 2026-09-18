# ADR-0020: Fail-fast production config, no auth bypass in the shipped path, container-first deploy

**Status:** Accepted
**Date:** 2026-09-18 · **Deciders:** Vivek (asked and approved), agent · **Work item:** CHORE-007

## Confidence

**Level:** High on the mechanisms (fail-fast validation, helmet, throttling, multi-stage
image), **Medium** on the claim "production ready" as a whole — this ADR hardens the
application, and the pilot still cannot run without an SMS provider the owner has to buy.
Saying otherwise would be the dishonest part.

## Research depth

**Quick check.** The mechanisms are standard and the two dependencies are the conventional
Nest choices; the audit that produced the gap list is recorded in CHORE-007's report. No
external research — nothing here is novel.

## Context and problem

Everything works on a laptop. Nothing has ever prepared it to run elsewhere: no security
headers, rate limiting only on OTP, an auth bypass (the dev OTP echo) sitting in the shipped
auth path behind two environment checks, no container, no CI, and no runbook. Separately,
misconfiguration fails *quietly* — a production deploy missing `CORS_ORIGINS` or with
`OTP_DEV_LOG=true` would start happily and be wrong.

## Options considered

**A. Where the dev OTP affordance lives**

1. **In the stub SMS channel, via a short-TTL Redis key** (chosen). The API returns
   `{ requested: true }` and nothing else, so the production auth path contains no bypass to
   reason about. The affordance lives in the adapter that production *replaces wholesale*
   with a real provider, which makes "it cannot ship" a structural fact rather than a
   promise about environment variables.
2. **Keep the double-gated response field.** Pro: simplest, already works. Con: an auth
   bypass stays in the shipped path forever, guarded only by config; every future reader has
   to re-derive that it is safe.
3. **Delete it with no replacement.** Pro: absolute. Con: the E2E harness cannot log in, so
   the one check that exercises the assembled system end to end loses most of its scenarios.

**B. Failing on bad production config**

1. **Refuse to boot** (chosen): in production, require `CORS_ORIGINS`, reject `OTP_DEV_LOG`,
   and reject example/default secrets. A deploy that is wrong stops immediately and loudly.
2. Warn and continue. Rejected: the failure modes are silent-by-nature (no CORS headers
   looks like a frontend bug; a leaked OTP looks like nothing at all).

**C. Deployment shape**

1. **Multi-stage Dockerfile + compose** (chosen): portable across Railway/Render/Fly/a VPS,
   and runnable locally, which means the deploy path is testable rather than aspirational.
2. Platform-specific config (a `render.yaml` or similar). Rejected: picks a vendor the owner
   has not chosen, and cannot be verified here.

## Decision

All three first options. Additionally: `helmet` for headers and `@nestjs/throttler` for a
global request ceiling, with the auth routes keeping their existing, tighter Redis limits —
the global limit is defence in depth, not a replacement for them.

## Consequences

Good: a mis-set production config cannot boot; the production auth path has no bypass; there
is an artifact to deploy and a pipeline that runs the real gate; the deploy path is
exercisable locally.
Bad: two new dependencies to keep patched; the throttle ceiling is a guess without
production traffic, so it may need tuning; the Dockerfile is one more thing to keep in step
with the workspace layout; and CI will be slower than the local gate because it builds too.

## Revisit trigger

- A real SMS provider lands → the stub channel (and with it the dev OTP affordance) stops
  being the default, and this ADR's option A becomes moot.
- Real traffic arrives → revisit the throttle ceiling with actual numbers instead of a guess.
- A platform is chosen → the generic image may be replaced by that platform's build, and
  `docker-compose.prod.yml` becomes a local-parity tool rather than the deploy path.
