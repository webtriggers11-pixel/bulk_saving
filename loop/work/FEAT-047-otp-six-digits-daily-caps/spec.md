# FEAT-047 — One 6-digit OTP for everyone; daily SMS caps; local production mode

**Status:** in-review · **Priority:** P1 · **Owner:** agent (owner request) · **Opened:** 2026-11-25

## Problem / Why

With real SMS (FEAT-046) the owner wants real, random codes, one consistent length (today residents get 4 digits, admins 8 — ADR-0040), and a limit on how many codes go out, because every code is an SMS from one phone's SIM. Owner's choices (2026-11-25): **6 digits**, **daily SMS cap (server-wide + per phone)**, **NODE_ENV=production in the local .env only**.

## Acceptance criteria

- [x] AC1: Every OTP, through both doors and for every role, is 6 digits (`OTP_CODE_LENGTH` in `@bulk/shared`); the society door no longer looks up the role to pick a length. Verify DTOs accept exactly 6 digits.
- [x] AC2: The web sign-in screens (resident and admin) say "6-digit code", size the input to 6, placeholder 123456; a short code gets a code message, not the phone hint.
- [x] AC3: Per phone (every door) at most `OTP_PHONE_DAILY_MAX` (default 10) codes per India day; server-wide at most `OTP_DAILY_MAX` (default 200). Past either: 429 `OTP_DAILY_LIMIT` "Too many codes have been sent today. Please try again tomorrow."; reaching the server cap logs one warning. Same for every caller and role.
- [x] AC4: Tests never spend a dev server's budget (env in the total key; load-env lifts both caps; behaviour tested with explicit low limits).
- [x] AC5: `OTP_DEV_FIXED_CODE` is 6 digits (`111111`); docs (`.env.example`, `TEST_LOGINS.md`) updated.
- [x] AC6: Owner's local `.env`: `NODE_ENV=production`, `OTP_DEV_LOG=false`, fixed code commented out; it passes the production boot checks.

## Out of scope

Demo server env/deploy; a per-IP daily cap; capping round notification SMS (lifecycle messages must not be dropped).
