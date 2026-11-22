# FEAT-031: Phone field shows a fixed `+91` the user can't edit; the user types only the 10-digit number

**Status:** done · **Priority:** P2 · **Owner:** owner (requested: "make +91 non editable only phone number will add by user") / agent · **Opened:** 2026-11-22

## Problem / Why
Both sign-in doors (resident `/onboard` and admin `/admin/login`) use one free-text field that
accepts any spelling (`+91 98765 43210`, `098765…`, `+1 415…`). The owner wants the country code
fixed on screen and only the mobile number typed.

## Acceptance criteria
- [x] AC1 — A shared `PhoneField` primitive: a visible, non-interactive `+91` prefix (not part of the input's
      value, cannot be selected, deleted or focused) and an input that holds at most 10 digits
      (`inputMode="numeric"`, `autoComplete="tel-national"`; deliberately NO `maxLength`: a browser truncates a paste to it before onChange, so the 10-digit cap lives in the sanitiser). Non-digits are dropped.
- [x] AC2 — Paste-friendly: pasting `+91 98765 43210`, `91 9876543210` or `098765 43210` leaves `9876543210`.
- [x] AC3 — Both doors use it. What's sent is always `+91` + the 10 digits, put into canonical form by
      `normalisePhone` (ADR-0036). "Send code" stays disabled until it's a valid Indian mobile number (starts 6–9), with the hint
      "Enter your 10-digit mobile number." The OTP step still says "Sent by SMS to +91…". The dev OTP toast still works.
- [x] AC4 — Tests: primitive (prefix not editable/not in value, digits only, 10-digit cap, paste
      forms), both pages (body sends `+91…`, hint, toast path). Gate; V2; V3.
- [x] AC5 — ADR-0042: the web is India-only for phone entry (amends ADR-0036 §2 on the web side; the API's
      normaliser is unchanged).

## Out of scope
Backend changes; a country picker (ADR-0036 revisit trigger: the first society outside India).
