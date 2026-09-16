# FEAT-001 — Society onboarding + phone-OTP auth (multi-tenant foundation)

**Status:** specced (open questions resolved) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-16

## Problem / Why

Bulk Saving is multi-tenant: every resident belongs to a building society, and all
their activity (rounds, jobs) must be scoped to that society (ADR-0003). Nothing can
be built until residents can onboard into the right society and authenticate. This
feature establishes the real domain model (Society, Resident) and the phone-OTP auth
that everything downstream depends on. It also pulls in the SMS-OTP slice of FEAT-006
(SMS-first, per BRIEF risk R1).

## User stories

1. As a **resident**, I can enter my society's invite code and my phone number, receive
   an OTP by SMS, and verify it — so that I'm onboarded into my society without paperwork.
2. As a **verified resident**, I stay logged in on my PWA (token refresh) so I don't
   re-verify every visit.
3. As a **super-admin**, I can authenticate with elevated privileges so that admin-only
   endpoints are protected from residents.
4. As the **platform**, I guarantee a resident can only ever see/act within their own
   society's data.

## Acceptance criteria (testable — this IS the definition of done)

**Domain model**
- [ ] Prisma models exist: `Society` (id, name, city, `inviteCode` unique, timestamps),
      `Resident` (id, `societyId` FK, phone, name nullable, `role` enum RESIDENT|SUPER_ADMIN,
      `verifiedAt`, timestamps), with a unique constraint on (`societyId`, `phone`).
- [ ] The throwaway `HealthPing` model is removed; migration applies cleanly.

**Onboarding / OTP request**
- [ ] `POST /auth/otp/request` with a valid `inviteCode` + `phone` generates a 6-digit OTP,
      stores it in Redis keyed by (society, phone) with a TTL, and dispatches it via the
      `NotificationChannel` SMS adapter. Response body NEVER contains the OTP.
- [ ] Invalid/unknown `inviteCode` → 4xx error envelope `INVALID_INVITE_CODE`; no OTP generated or sent.
- [ ] Resend is rate-limited: too-frequent requests → error `OTP_RATE_LIMITED` (limits in Open Questions).

**OTP verify → auth**
- [ ] `POST /auth/otp/verify` with the correct OTP within TTL: creates or links the `Resident`
      to the society (from the invite code — `societyId` is NEVER taken from the request body),
      sets `verifiedAt`, and returns a JWT **access** token + **refresh** token.
- [ ] Wrong OTP → `OTP_INVALID`; after N failed attempts the OTP is invalidated → `OTP_LOCKED`.
- [ ] Expired/absent OTP → `OTP_EXPIRED`.
- [ ] OTP values are never written to logs or returned in any response.

**Sessions / roles / tenancy**
- [ ] `GET /me` with a valid access token returns the caller's own profile scoped to their society.
- [ ] `POST /auth/refresh` rotates the refresh token; a previously-used refresh token is rejected (`TOKEN_REVOKED`).
- [ ] A SUPER_ADMIN-only test endpoint returns 403 `FORBIDDEN` for a RESIDENT token and 200 for a SUPER_ADMIN token (role guard works).
- [ ] **Tenant isolation:** an integration test proves a resident authenticated in Society A
      cannot read a resident/record belonging to Society B (cross-tenant access denied).

**General**
- [ ] All new endpoints use DTO + class-validator and the standard success/error envelope.
- [ ] `bash scripts/verify.sh` passes (unit + integration incl. an OTP happy-path and the isolation test); TypeScript strict, no `any`.

## Out of scope (explicit, prevents gold-plating)

- Society creation UI and super-admin management UI — societies + the first super-admin
  are **seeded via a script** in v1 (no self-serve society signup).
- QR-code generation/rendering — the invite-code string is in scope; the QR is a thin
  frontend wrapper deferred to the PWA polish work.
- Production SMS provider integration — v1 uses a **stub/console SMS adapter** (logs the
  OTP in dev, sent-status only) behind the `NotificationChannel` interface; the real
  provider is a config swap + its own ADR when we approach launch (no money spent now).
- WhatsApp channel (fast-follow, later work item).
- One phone belonging to multiple societies (v1: a resident record is one phone per society).
- Full profile editing (only minimal name capture at onboarding).

## Resolved decisions (Vivek, 2026-09-16)

1. **Super-admin bootstrap:** seed script inserts societies + a SUPER_ADMIN resident by phone.
2. **Invite code:** 8-char uppercase alphanumeric, one per society, regenerable later.
3. **OTP policy:** 6 digits · 5-min TTL · 5 verify attempts then locked · resend max 1/30s and 5/hour.
4. **Name at onboarding:** optional resident name; phone required.
5. **SMS:** stub/console `NotificationChannel` adapter in v1 (OTP logged in dev, not really sent);
   real provider deferred to pre-launch with its own ADR. No money spent.
6. **Scope:** FULL-STACK — backend auth API + React PWA onboarding screens (invite code → phone
   → OTP → logged in), an end-to-end clickable flow.
