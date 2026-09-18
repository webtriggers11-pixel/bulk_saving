# CHORE-007 — Production hardening

**Status:** in-progress · **Priority:** P0 · **Owner:** Vivek · **Opened:** 2026-09-18

## Why

Asked for directly: "make it production ready". The feature set is complete and tested, but
the application has never been prepared to run anywhere but a laptop. Audit findings:

| Gap | State before |
|---|---|
| Security headers | **None.** No helmet, no HSTS/nosniff/frame-deny/referrer-policy |
| Rate limiting | Only on OTP request (Redis, 1/30s + 5/hour). Every other route unlimited |
| Dev OTP echo | An **auth bypass** still in the shipped auth path (ADR-0016 mandatory trigger) |
| `OTP_DEV_LOG` in prod | Silently ignored rather than refused — a mis-set flag fails quiet |
| Production env rules | `CORS_ORIGINS` optional everywhere; example secrets accepted |
| Container image | **No Dockerfile.** Nothing deployable exists |
| CI | **No pipeline.** `verify.sh` has never run anywhere but here |
| Deploy docs | No runbook: migrations, seeding, secrets, health checks undocumented |

## Scope (this item)

1. **Remove the OTP echo from the API** and move the dev affordance into the stub SMS
   channel (short-TTL Redis key), so the production auth path has no bypass at all and the
   adapter that holds it is the one production replaces. Owner-approved.
2. **helmet + @nestjs/throttler** (owner-approved dependencies): security headers, and a
   global request limit with auth routes keeping their own tighter Redis limits.
3. **Fail-fast production config:** refuse to boot in production when `CORS_ORIGINS` is
   missing, `OTP_DEV_LOG` is on, or any secret is still an example value.
4. **A deployable artifact:** multi-stage Dockerfile for the API, a static build for the
   PWA, and `docker-compose.prod.yml` wiring them to Postgres + Redis.
5. **CI:** GitHub Actions running the real gate (`scripts/verify.sh`) with Postgres + Redis
   services, so the gate runs somewhere other than this machine.
6. **DEPLOY.md:** the runbook — secrets, migrations, seeding the first society, health
   checks, and what to do about the pilot's SMS provider.

## Explicitly NOT in scope (needs the owner)

- **Choosing and paying for an SMS provider.** Costs money. The stub still sends nothing, so
  no resident can receive an OTP in production yet — this is the one gap that makes the
  product unusable rather than merely unhardened.
- Hosting platform, domain, TLS certificates, and where secrets live.
- Error monitoring / APM (a paid service in most cases).
- Load testing and capacity planning.

## Definition of done

`verify.sh` green; the API refuses to boot with a production-unsafe config; `docker compose
-f docker-compose.prod.yml up` serves the API and the PWA against Postgres + Redis; CI runs
the gate; DEPLOY.md documents the path from an empty server to a live society.
