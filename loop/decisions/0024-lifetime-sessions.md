# ADR-0024: Sessions do not expire; revocation lives entirely in the Redis rotation handle

**Status:** Accepted
**Date:** 2026-09-19 · **Deciders:** Vivek (explicit: "once login with phone otp lifetime login"), agent · **Work item:** FEAT-013

## Confidence

**Level:** Medium
**Basis:** The mechanism is certain — omitting `exp` and omitting `EX` does exactly what it
says, and the rotation CAS is unaffected by either. The Medium is entirely about whether
this is the right policy for an app that will hold real payment records, not about whether
the code will behave.

## Research depth

**Judgment call.** The requirement came from the owner directly and is not a technology
choice to research; what needed thought was which safety property to keep, not which
library to use.

## Context and problem

Refresh tokens expired after 30 days. The owner wants one OTP to be the last one: verify a
phone, stay signed in. The question this ADR settles is not "should sessions be long" — it
is **what still ends a session once the clock no longer does.**

## Options considered

1. **No `exp`, no Redis TTL; revocation via the handle** — chosen. Honest about what it is:
   there is no expiry, and there is exactly one way to end a session.
2. **A very long TTL (10 years)** — rejected as dishonest. It is a lifetime session wearing
   a number, and the number is a trap for whoever reads it in 2036.
3. **Lifetime refresh token, 30-day Redis handle** — rejected, and worth naming because it
   is what you get by changing `signPair` and forgetting the rotation Lua: a token that
   never expires, guarded by a handle that does. The session dies 30 days after its last
   use while every signature says otherwise.

## Decision

1. `JWT_REFRESH_TTL_SECONDS` unset or `0` (the default) means **no expiry**: the refresh
   token is signed without `expiresIn` and the `refresh:<residentId>` handle is stored
   without `EX`, at issue **and on every rotation**.
2. A positive value restores an expiring session, unchanged in behaviour from before.
3. **The access token stays short (15 min).** This is load-bearing: it is what makes (4)
   take effect in minutes rather than never.
4. **Revocation is `DEL refresh:<residentId>`.** One key, one session, effective within one
   access-token lifetime. Rotation-on-use is unchanged, so a stolen-and-replayed refresh
   token still kills itself.

## Consequences

Good: one OTP per device, forever. Rotation and the kill switch both survive.

Bad, and stated plainly because the spec asked for it: a never-expiring session in
localStorage means a stolen device or one successful XSS is **permanent** access, and for a
SUPER_ADMIN that is permanent access to every society's rounds and payments. Expiry was the
backstop for the case where nobody notices; that backstop is gone by choice. What remains
requires someone to act. There is currently no screen that lets them — revoking means a
`redis-cli DEL`.

## Revisit trigger

**Mandatory, two triggers, either one:**
- Before the first deployment that serves a real society — at which point the localStorage
  note in `auth.store.ts` (httpOnly refresh cookie) stops being a "pre-launch improvement"
  and becomes this ADR's precondition.
- The first report of a lost or shared admin device. If the answer to "end that session" is
  still "ask an engineer to run redis-cli", this decision is overdue, and the missing piece
  is a sign-out-everywhere control, not a shorter clock.
