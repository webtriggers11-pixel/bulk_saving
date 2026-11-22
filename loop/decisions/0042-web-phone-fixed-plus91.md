# ADR-0042: The web phone field has a fixed `+91` prefix; users type only the 10-digit mobile number

**Status:** Accepted · **Date:** 2026-11-22 · **Deciders:** owner ("make +91 non editable only phone number will add by user"), agent · **Work item:** FEAT-031 · **Amends:** ADR-0036 §2 (web side only)

## Confidence
**Level:** High. It's a small UI rule and the canonical form doesn't change. Med on the product side: it shuts the web door
to non-Indian numbers, which ADR-0036 already called a product assumption.

## Research depth
**Judgment call.**

## Context
ADR-0036 made the API accept many spellings and settle on one E.164 form, with India as the default. The web field was
free text, so users could type a `+`, a trunk `0`, or a foreign code. The owner wants `+91` fixed on screen.

## Decisions
1. Both sign-in doors use one `PhoneField` primitive. `+91` is a visible label beside the input, never part of its value.
   The input holds only digits, at most 10.
2. Paste-friendly: a pasted `+91 …`, `91…` or `0…` has its prefix removed before the 10-digit cap.
3. The web always sends `normalisePhone('+91' + digits)`, so the stored form is unchanged.
4. The API's `normalisePhone` is **unchanged**. It still accepts every ADR-0036 spelling for other clients (WhatsApp, curl, tests).

## Consequences
Good: users type less, there's less to get wrong, and the field shows exactly what's stored.
Bad: a non-Indian number can't be entered on the web, by design.

## Revisit trigger
Same as ADR-0036: the first society outside India. At that point the prefix becomes a per-society country picker.
