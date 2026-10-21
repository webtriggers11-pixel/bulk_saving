# ADR-0007: Phone-OTP authentication with JWT access + rotating refresh; OTP state in Redis

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (human-approved), agent · **Work item:** FEAT-001

## Confidence

**Level:** Medium
**Basis:** OTP + JWT is a standard, well-understood auth pattern; the specific
refresh-rotation + Redis-OTP details are established practice but not validated
against a specific library version this session.

## Research depth

**Depth:** Judgment call

- Chosen from established patterns + the founder's onboarding decisions. If refresh-token
  security or OTP hardening needs deeper validation before launch, the `stack-researcher`
  subagent can review against current NestJS/JWT guidance.

## Context and problem

Residents onboard via a society invite code and authenticate by phone (no passwords,
per BRIEF). The system is multi-tenant (ADR-0003) and role-based (RESIDENT|SUPER_ADMIN).
We need short-lived sessions with refresh, OTP that resists brute force, and no secrets
leaked — without a paid SMS provider in v1.

## Options considered

1. **Phone-OTP → JWT access + rotating refresh; OTP + counters in Redis** (chosen) —
   pro: passwordless, stateless access tokens, Redis gives natural TTL + atomic rate-limit
   counters; con: refresh rotation + revocation needs a store (Redis).
2. **Server sessions (cookie + session store)** — simpler revocation, but a PWA calling a
   cross-origin API is cleaner with bearer JWTs; rejected for this architecture.
3. **Third-party auth (Firebase Auth phone, Auth0)** — offloads OTP/SMS, but adds a paid/
   external dependency and less control over the tenant/role model; rejected for v1.

## Decision

- **OTP:** 6-digit (now **4-digit**, see ADR-0040 / CHORE-026), generated server-side, stored in Redis keyed by (societyId, phone)
  with a 5-min TTL. Verify attempts (max 5) and resend limits (1/30s, 5/hour) enforced via
  Redis counters. OTP is **never** returned in a response or written to logs.
- **Delivery:** via a `NotificationChannel` interface; v1 uses a **stub adapter** (logs in
  dev). Real SMS provider is a later config swap (its own ADR).
- **Tokens:** JWT **access** (short-lived, e.g. 15 min) carrying `sub` (residentId),
  `societyId`, `role`. **Refresh** token (longer-lived) is **rotated** on each use; the
  current valid refresh token (or its id) is tracked in Redis so a reused/old token is
  rejected (revocation).
- **Guards:** a Nest auth guard validates access tokens and populates request context;
  a `@Roles()` decorator + roles guard enforce RESIDENT vs SUPER_ADMIN. `societyId` for
  tenant scoping always comes from the token, never the request body.
- Secrets (JWT signing keys) come from validated env config; never committed.

## Consequences

Good: passwordless, low-friction onboarding; stateless access checks; Redis gives free
TTL + atomic counters; provider-agnostic delivery; refresh rotation limits token theft.
Bad: Redis is now on the auth critical path (already required infra); refresh rotation
adds a small amount of state + care around race conditions on concurrent refreshes.

## Revisit trigger

Before production launch, or if abuse is observed: re-examine OTP hardening (per-IP/per-
device limits), refresh-token theft-detection, and whether to adopt a managed auth
provider. Revisit delivery when the real SMS/WhatsApp provider is chosen.
