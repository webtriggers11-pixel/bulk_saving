# FEAT-048 — Onboarding name is required

## Why
Owner request (2026-11-25): "make onboarding name required field". Residents who skipped
the optional name show up nameless to admins and in rounds.

## Acceptance
- AC1: the onboarding code step shows "Your name" (no "(optional)"), marked required, max 80 chars.
- AC2: "Verify & continue" stays disabled until the code AND a non-blank name are entered.
- AC3: the web sends the name trimmed.
- AC4: `POST /auth/otp/verify` rejects a missing, blank (spaces only) or >80-char name with 400 BAD_REQUEST, before the OTP is checked or used.
- AC5: the API stores the trimmed name. A returning resident who signs in again overwrites the stored name with the typed one (as before, when a name was given).
- Out of scope: the admin door (no name, never creates a resident), the WhatsApp door (switched off; keeps its profile-name default), existing nameless residents.
