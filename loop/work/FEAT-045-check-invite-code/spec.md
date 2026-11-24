# FEAT-045 — Check the invite code with the server before the next step

**Status:** in-progress · **Priority:** P1 · **Owner:** owner / agent · **Opened:** 2026-11-24

**Owner request (2026-11-24):** "once the invite code is sent, also check in the back end that invite code is correct or not. If it is correct then only we will go to the next step otherwise we will show error: This is an invalid invite code."

## Problem / Why

The invite step on `/onboard` only checks the code's *shape* (8 letters/numbers, BUG-021). A well-formed but wrong code (or an inactive society's code, ADR-0045) moves the resident on to the WhatsApp/phone step. They type a phone number, and only then does `POST /auth/otp/request` say the code is unknown. By that point the error shows on the wrong screen.

## User stories

1. As a resident, when I tap Continue with a wrong invite code, I see "This is an invalid invite code." on the invite step, and I can't move on until the code is right.

## Acceptance criteria

- [ ] AC1. `POST /auth/invite/check` `{ inviteCode }` (DTO, same 8-char shape) → 200 `{ valid: true }` for an active society's code; 400 `INVALID_INVITE_CODE` for an unknown code or an inactive society's code (same answer for both, ADR-0045 §4). It sends nothing and creates nothing.
- [ ] AC2. Wrong guesses are budgeted per client IP bucket (Redis, atomic INCR+EXPIRE): after 20 failed checks in an hour → 429 `INVITE_CHECK_RATE_LIMITED`. Valid checks are never counted.
- [ ] AC3. Web: Continue on the invite step calls the check. On success → the next step (choose / phone) as before. On `INVALID_INVITE_CODE` → stays on the invite step, with an error that reads "This is an invalid invite code." Shape errors still never reach the server (BUG-021). While the check is in flight the button reads "Checking…" and is disabled. Editing the code clears the error.
- [ ] AC4. The existing message for `INVALID_INVITE_CODE` (shown by later doors too) becomes "This is an invalid invite code. Check it with your society and try again."
- [ ] AC5. Tests: backend integration (valid / unknown / inactive / malformed / rate limit / valid not counted), web (success advances, invalid stays + message, pending label, error cleared on edit). Gate, V2, V3.

## Out of scope

- Showing the society's name after a valid check (it would hand society names to anyone guessing codes; the owner didn't ask for it).
- Removing the check from the OTP/WhatsApp doors: they still check the code themselves (the client is never trusted, ADR-0003).

## Open questions

- None. Autonomous mode: recommended defaults taken (see ADR-0052).
