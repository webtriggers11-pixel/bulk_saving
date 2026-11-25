# ADR-0057: A resident's name is required at the society sign-in door

**Status:** Accepted
**Date:** 2026-11-25 · **Deciders:** owner (asked for it) + agent · **Work item:** FEAT-048

## Confidence

**Level:** High
**Basis:** a small validation change on one endpoint and one form, covered by integration and component tests.

## Research depth

**Depth:** Judgment call — owner request; the existing DTO, upsert and onboarding form were read.

## Context

`POST /auth/otp/verify` took an optional `name` (`@IsOptional`, 1–80), and the onboarding form labelled it "(optional)". Residents who skipped it are nameless in admin lists and rounds.

## Options considered

1. **Web-only required** — easy, but any other client can still create nameless residents.
2. **Web + API required** — the rule holds for every client. Chosen.
3. **Required only for first sign-in (new rows)** — needs the form to know whether the phone already exists, which leaks membership (the doors are kept indistinguishable, ADR-0027). Rejected.

## Decision

Option 2. `OtpVerifyDto.name` is trimmed (`class-transformer` `@Transform`, as other DTOs do) and must be a 1–80 character string; `OtpVerifyBody.name` in `@bulk/shared` is no longer optional. The form marks the field required (`maxLength` 80) and keeps "Verify & continue" disabled until the code and a non-blank name are filled. Validation runs before the OTP is checked, so a rejected body does not spend the code.

## Consequences

- A returning resident types their name each sign-in, and it replaces the stored one (the upsert already did this whenever a name was sent). Sign-ins are rare (lifetime sessions, ADR-0024).
- An admin who signs in through the society door also sets their name there.
- Old clients (a cached PWA before the update) that omit the name get a 400 until the service worker refreshes; the update prompt handles that.
- Existing nameless residents stay nameless until they next sign in.

## Revisit trigger

Residents complain about retyping their name → pre-fill it on a returning device, or ask only on first sign-in once that can be done without revealing membership.
