# ADR-0045: `active` flags on residents and societies. Deactivate, don't delete

**Status:** Accepted · **Date:** 2026-11-22 · **Deciders:** owner ("active in active all type of things"), agent · **Work item:** FEAT-035 · **Builds on:** ADR-0024, ADR-0043, ADR-0044

## Confidence
**Level:** High for the shape. Med for the society rule (blocks new joins only), which is a product call the owner can tighten.

## Research depth
**Judgment call.**

## Decisions
1. **Additive migration:** `Resident.active` and `Society.active`, `Boolean NOT NULL DEFAULT true`. There's no backfill and every existing row stays active, so rolling back is a column drop.
2. **An inactive resident** is refused at OTP verify, at WhatsApp confirm and at refresh with `ACCOUNT_DISABLED`. OTP *request* still answers the usual generic "sent", to keep enumeration resistance (ADR-0023). Deactivating revokes all of their sessions, so access ends within one access-token lifetime.
3. **Guards:** the same as ADR-0044. You can't deactivate yourself or the last active SUPER_ADMIN.
4. **An inactive society** refuses new joins: its code answers `INVALID_INVITE_CODE`, exactly like an unknown code, so the code says nothing about the society. Existing residents are untouched. Deactivating each resident is the per-person tool.
5. **Deactivate is the everyday tool. Delete stays for empty or mistaken records** (ADR-0043 §3, ADR-0044 §5).

## Revisit trigger
A request to suspend a whole society's residents at once, or for a reason/audit note on deactivation.
