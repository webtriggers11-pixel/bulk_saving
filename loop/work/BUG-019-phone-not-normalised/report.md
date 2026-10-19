# BUG-019 — The phone number is stored exactly as typed: `9999900201` and `+919999900201` are two residents

**Status:** in-progress · **Priority:** P2 · **Opened:** 2026-10-19 · **Reporter:** agent (FEAT-020 T7 browser pass)

## Observed vs expected
- **Observed:** the onboarding phone field accepts `9999900201`; `POST /auth/otp/request` and `/verify` use the string as-is (DTO: `/^\+?[0-9]{7,15}$/`), the OTP is stashed under `dev:last-otp:9999900201`, and `upsertVerified` keys the resident on `(societyId, phone)` — so the same person typed two ways becomes two residents, with two pledge histories and two push subscriptions. The field's placeholder suggests `+91 98765 43210`, the seed uses `+91…`.
- **Expected:** one canonical form per number (E.164, India default: 10 digits → `+91` + digits; strip spaces/dashes; `0` prefix dropped) applied in ONE place on the server before rate limiting, OTP storage and the resident upsert; the web shows the canonical form back.
- **Where:** `apps/backend/src/modules/auth/auth.dto.ts` (PHONE regex), `auth.controller.ts` (uses `dto.phone` raw), `residents.service.ts` (`upsertVerified`, `findAdminByPhone`), `apps/web/src/features/auth/OnboardingPage.tsx`.

## Reproduction (the spec for this bug)
- **Failing test:** `auth.integration.spec.ts` — request + verify with `9999900201` then with `+919999900201` in the same society → ONE resident, same id; and the admin door accepts either form for a `+91…` admin.
- **Reproduced on:** 2026-10-19 (two `dev:last-otp:` keys for one person).

## Root cause
No normalisation layer; the DTO regex is permissive about the `+` and the country code.

## Decision-log check
ADR-0007 (phone + OTP) does not define a canonical phone form. Fixing adds one (small ADR or an addendum); the existing seed and residents are already `+91…`, so no data migration — except any duplicates created by the dev team, which a one-off query can list.

## Fix
- **What:** `normalisePhone` in `@bulk/shared` (E.164, India default; ADR-0036); applied by `phoneOf(dto)` in `AuthController` at all six entry points; the DTO admits formatting characters and the normaliser decides; the web sends and shows the canonical form.
- **Commit:** `fix(BUG-019): ...` (see LOG)
- **Regression guard:** the integration test above; a unit test for the normaliser (spaces, dashes, `0` prefix, `+91`, 10 digits, non-Indian numbers passed through).

## Lesson
none yet.
