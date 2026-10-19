# ADR-0036: One canonical phone form — E.164, India by default

**Status:** Accepted · **Date:** 2026-10-19 · **Deciders:** agent (owner's rule "one OTP per device, forever" presumes one identity per phone) · **Work item:** BUG-019 · **Builds on:** ADR-0007 (phone + OTP)

## Confidence
**Level:** High (the rule is small and fully unit-tested; the integration test proves four spellings are one resident) · Medium (the India default is a product assumption — true for every society in BRIEF.md)

## Research depth
**Judgment call.** E.164 is the only sane storage form; the question was only where to apply it and what a bare 10-digit number means.

## Context
The phone reached the rate limiter, the OTP stash and the resident upsert exactly as typed. `9999900201` and `+919999900201` became two residents with two pledge histories and two push devices; the resend throttle and the OTP budget were per spelling too, so the budget could be dodged by re-spelling the number.

## Decisions
1. **Canonical form is E.164** (`+` and digits, 7–15 digits). It is computed by `normalisePhone` in `@bulk/shared` — one function for the API and the web.
2. **India is the default country:** 10 digits → `+91…`; `0` + 10 digits → `+91…`; `91` + 10 digits → `+91…`. Anything with `+` or `00` keeps its own country code. Anything else is refused (null → 400), not guessed.
3. **Applied in the controller, before anything keys on the phone** — the limiter, the OTP key, the resident row, the admin lookup. The DTO only admits formatting characters; the normaliser is the check.
4. **The web sends the canonical form** and shows it back ("Sent by SMS to +91…"), so what the resident sees is what is stored.
5. **No data migration:** every seeded and real row is already `+91…`. Any duplicate a developer created by typing the bare number is a dev-DB leftover (CHORE-011's territory).

## Consequences
Good: one person, one row, one budget, one device list, whatever they type.
Bad: a non-Indian number typed without `+` is refused rather than guessed — by design.

## Revisit trigger
The first society outside India: the default country becomes a per-society setting.
