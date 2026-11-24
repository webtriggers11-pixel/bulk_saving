# ADR-0050: A society's address as structured nullable columns, required by the API on create

**Status:** Accepted · **Date:** 2026-11-24 · **Deciders:** Vivek ("in the society creating time, we need to add proper [detailed] address also phone number is optional"), agent · **Work item:** FEAT-043 · **Builds on:** ADR-0043 (society onboarding), ADR-0036/0042 (canonical +91 phone)

## Decisions
1. **Six columns on `Society`, not one JSON or free-text blob:** `addressLine1`, `addressLine2`, `landmark`, `state`, `pincode` and `contactPhone`. Structured fields can be validated (state from a fixed list, a 6-digit PIN code), can be searched and filtered later (for example "societies in 411045"), and format the same way everywhere (`formatSocietyAddress` in `@bulk/shared`).
2. **Nullable in the database, required by the API.** The migration is purely additive (`ADD COLUMN … TEXT`), so societies created before it keep working. `CreateSocietyDto` requires line 1, state and pincode. `UpdateSocietyDto` lets them be set but never cleared, and lets line 2, landmark and phone be cleared with null or "". No CHECK constraint, because old rows have no address yet.
3. **State is a closed list:** the 28 states and 8 union territories (`INDIAN_STATES`), checked with `@IsIn` on the server and shown as a select in the form.
4. **The phone is optional, canonical and Indian:** normalised with `normalisePhone`, then it must match `^\+91[6-9]\d{9}$`. The form uses the fixed-+91 `PhoneField` (FEAT-031).
5. **Old societies are visible, not blocked.** The list shows "No address" and the society page shows "Address missing". Saving the Details form requires the address, so the next edit of an old society fills it in.

## Confidence
**High.** The server rules have integration tests for create, edit, clearing, and refusing bad values. The form has tests for validation, the canonical phone, the missing-address states and the formatted address.

## Research depth
**Quick check:** PIN codes are 6 digits with a first digit of 1–9. India has 28 states and 8 union territories (after the 2020 merger of Dadra and Nagar Haveli with Daman and Diu).

## Consequences
Good: vendors and operators get a usable address and a tap-to-call number; the data is clean enough to filter by city or PIN later. Bad: the state list is a code change if the map changes; old societies stay address-less until someone edits them.

## Revisit trigger
Societies outside India, or a geocoding / map-pin need → add `lat`/`lng` (and maybe a country) rather than overloading these fields.
