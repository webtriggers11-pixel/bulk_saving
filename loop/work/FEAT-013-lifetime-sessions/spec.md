# FEAT-013 — One OTP, then signed in for good

**Status:** specced · **Priority:** P1 · **Owner:** Vivek (requested) / agent · **Opened:** 2026-09-19

## Problem / Why

Refresh tokens expire after 30 days, so a resident who verified their phone is asked to
do it again a month later — a code they must wait for, on a number they may no longer
have the SIM for, to see a round they already joined. For an admin it is worse: the
re-verification lands exactly when they need the dashboard. The ask is that verifying a
phone once is enough, permanently.

## User stories

1. As a resident, once I have verified my phone I stay signed in on this device
   indefinitely, so that I never repeat the OTP dance.
2. As an admin, my dashboard is there when I open it, however long since I last did.

## Acceptance criteria (testable — this IS the definition of done)

- [ ] AC1 — a refresh token issued at sign-in carries no `exp` claim.
- [ ] AC2 — the Redis rotation handle (`refresh:<residentId>`) is stored with no TTL.
- [ ] AC3 — a refresh performed against a token minted arbitrarily far in the past
      succeeds (proven with a token whose `iat` is years old).
- [ ] AC4 — rotation still holds: a refresh token that has already been used is still
      refused with `TOKEN_REVOKED`.
- [ ] AC5 — deleting `refresh:<residentId>` in Redis still ends that session — the kill
      switch survives. A session with a lifetime refresh token is revocable.
- [ ] AC6 — the access token is unchanged: still short-lived (15 min default), so a
      revoked session dies within one access-token lifetime.
- [ ] AC7 — the lifetime is a configured default, not a hardcode: `JWT_REFRESH_TTL_SECONDS`
      set to a positive number restores an expiring refresh token for anyone who wants one.

## Out of scope

- Moving tokens out of localStorage into httpOnly cookies. That is the right hardening
  and it is a separate, larger change (see the SECURITY NOTE in `auth.store.ts`).
- A "sign out everywhere" UI. The Redis kill switch exists; no screen for it yet.
- Idle timeouts, device lists, session management screens.

## Risk accepted (stated, not hidden)

A never-expiring session in localStorage means a stolen device or one successful XSS is
permanent access, with no clock to eventually close it — and for a SUPER_ADMIN that is
permanent access to every society's rounds and payments. The expiry was the backstop for
the case where nobody notices. What remains is the Redis handle: deleting one key ends
one session, within 15 minutes. This trade was requested explicitly; it is recorded in
ADR-0024 with a revisit trigger rather than argued here.
