# ADR-0034: One session per device sign-in; sign-out ends only that session

**Status:** Accepted · **Date:** 2026-10-19 · **Deciders:** Vivek ("one time authenticate then lifetime login access; if they uninstall and install again then only again OTP"), agent · **Work item:** BUG-017
· **Amends:** ADR-0024 (lifetime sessions) — its revocation clause, "one key, one session"

## Confidence
**Level:** High (mechanism — compare-and-set per session, migration of pre-fix tokens, both
integration-tested against real Redis) · Medium (operational: the kill switch is still a Redis
command, not a screen — unchanged from ADR-0024's revisit trigger)

## Research depth
**Judgment call.** The owner's rule is a product rule; what needed thought was how to represent
"a device" without a device identity the browser does not give us, and how to ship it without
signing anyone out.

## Context
ADR-0024 made sessions permanent and kept one Redis handle per RESIDENT (`refresh:<residentId>` →
current jti). That handle is overwritten on every OTP verify, so the owner's rule — one OTP per
device, forever — failed the moment a resident had two devices: the second sign-in revoked the
first within one access-token lifetime. Found while closing FEAT-020 (BUG-017).

## Decisions
1. **A session is a sign-in.** `issueTokens` mints a session id (`sid`, a UUID carried in the
   refresh token beside `jti`). The handle is `refresh:<residentId>:<sid>` → current jti, and
   `sessions:<residentId>` (a Redis SET of sids) indexes them. Nothing identifies the device
   itself — "device" is whatever holds the token — which is exactly the owner's rule: a
   reinstall loses the token and is a new session.
2. **Rotation is unchanged in spirit:** compare-and-set on THIS session's key. A reused token
   ends only its own session's trust (TOKEN_REVOKED), never a sibling's.
3. **Nobody is signed out by the fix.** A pre-fix token (no `sid`) is honoured: its first
   rotation moves the handle from `refresh:<residentId>` to a fresh per-session key in the same
   Lua step, and the new token carries the `sid`. The legacy key is read, never written.
4. **Sign-out is now server-side too:** `POST /auth/sign-out` (access-token guarded, body = the
   refresh token) deletes that session's key and index entry. The web app calls it on every
   explicit sign-out, bounded to 3s and best-effort — offline, the phone forgets the token
   anyway and the stale handle is the same residual as a lost phone.
5. **The kill switch is now "sign out everywhere":** `AuthService.revokeAllSessions` walks the
   index; by hand it is `DEL` of every `refresh:<residentId>:*` key plus `sessions:<residentId>`
   (DEPLOY.md). Still effective within one access-token lifetime, so the 15-minute access TTL
   stays load-bearing.
6. **The index follows the session clock.** Under an expiring policy (`JWT_REFRESH_TTL_SECONDS`
   > 0) the set carries the same EX, refreshed on every rotation; under the lifetime policy it
   is PERSISTed. A sign-out SREMs its sid, so the set does not grow with sign-outs — only with
   sign-ins that are never signed out (a reinstall, a lost phone), which is unbounded by the
   owner's own rule and costs one small key each.

## Consequences
Good: the owner's rule holds across devices; a sign-out means something on the server for the
first time; the audit's "reuse does not revoke" note is unchanged in scope but now at least
cannot revoke the WRONG device.
Bad, kept from ADR-0024 and now multiplied: every session is permanent until someone acts, and
there is still no screen for "end every session of this resident" — a `redis-cli` procedure.
Under an EXPIRING policy the index's clock is refreshed by any session's rotation, so the sid of
a session that expired on its own stays in `sessions:<rid>` as a dangling member until every
session is gone (V2 P3-2); harmless — the kill switch DELs keys that may not exist — and
admitted here rather than hidden. Issue is one Lua step like rotation (V2 P3-1).

## Revisit trigger
ADR-0024's triggers stand. Add: when the first "sign out everywhere" request arrives from a
resident or an admin, build the screen on `revokeAllSessions` rather than extend the manual
procedure.
