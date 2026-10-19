# BUG-017 — Signing in on a second device ends the first device's lifetime session

**Status:** triaged · **Priority:** P1 · **Opened:** 2026-10-19 · **Reporter:** owner ("one time authenticate then lifetime login access; if they uninstall and install again then only again OTP")

## Observed vs expected

- **Observed:** the rotation handle is ONE Redis key per resident (`refresh:<residentId>` → current jti). `issueTokens` overwrites it on every OTP verify, so a sign-in on a second device (or a second browser, or the same phone after a reinstall) makes the first device's next refresh fail the compare-and-set → 401 TOKEN_REVOKED → the web app signs that device out within one 15-minute access token. The owner's phone was signed out by this session's own browser pass.
- **Expected:** one OTP per DEVICE, forever (ADR-0024). A second device gets its own session; neither ends the other. Only a reinstall (storage gone) or an explicit sign-out / revocation needs a new OTP.
- **Where:** `apps/backend/src/modules/auth/auth.service.ts` (`refreshKey`, `issueTokens`, `refresh`), any environment.

## Reproduction (the spec for this bug)

- **Failing test:** `apps/backend/src/modules/auth/auth.service.spec.ts` → "a second device's sign-in does not end the first device's session" — issue tokens twice for one resident, refresh with the FIRST pair → must succeed; today throws TOKEN_REVOKED.
- **Reproduced on:** 2026-10-19

## Root cause

ADR-0024 chose "one key, one session" for the kill switch, and `refreshKey(residentId)` encodes that: the handle is keyed by resident, not by session. Multi-device was never represented.

## Decision-log check

ADR-0024 (lifetime sessions) — its revocation clause ("one key, one session, `DEL refresh:<residentId>`") is what this bug is a symptom of. Fixing requires AMENDING it: per-session handles `refresh:<residentId>:<sid>` plus a per-resident index set so "end every session of this resident" stays one operation. → ADR-0034.

## Fix

- **Commit:** <hash — `fix(BUG-017): ...`>
- **Regression guard:** the failing test above, plus "signing out ends only this device's session".

## Lesson

none (a product rule arrived after the design; the ADR is amended, not the manual).
