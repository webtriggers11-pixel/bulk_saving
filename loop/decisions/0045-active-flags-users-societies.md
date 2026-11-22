# ADR-0045: `active` flags on residents and societies. Deactivate, don't delete

**Status:** Accepted · **Date:** 2026-11-22 · **Deciders:** owner ("active in active all type of things"), agent · **Work item:** FEAT-035 · **Builds on:** ADR-0024, ADR-0043, ADR-0044

## Confidence
**Level:** High for the shape. Med for the society rule (the code admits nobody; signed-in members stay in), which is a product call the owner can change.

## Research depth
**Judgment call.**

## Decisions
1. **Additive migration:** `Resident.active` and `Society.active`, `Boolean NOT NULL DEFAULT true`. There's no backfill and every existing row stays active, so rolling back is a column drop.
2. **An inactive resident** is refused at OTP verify, at WhatsApp confirm and at refresh with `ACCOUNT_DISABLED`. OTP *request* still answers the usual generic "sent", to keep enumeration resistance (ADR-0023). Deactivating revokes all of their sessions, so access ends within one access-token lifetime.
3. **Guards:** the same as ADR-0044. You can't deactivate yourself or the last active SUPER_ADMIN.
4. **An inactive society's code admits nobody**, new or returning: every door answers `INVALID_INVITE_CODE`, exactly like an unknown code. Residents
   already signed in keep their sessions, since sessions don't expire (ADR-0024). *(Revised during build: the first draft said "new joins only",
   but residents sign in again with the same code plus their phone, so telling a new join from a returning member at the door would add
   complexity and leak membership. Deactivating each resident is the per-person tool.)*
5. **Deactivate is the everyday tool. Delete stays for empty or mistaken records** (ADR-0043 §3, ADR-0044 §5).

## Revisit trigger
A request to suspend a whole society's residents at once, or for a reason/audit note on deactivation.
