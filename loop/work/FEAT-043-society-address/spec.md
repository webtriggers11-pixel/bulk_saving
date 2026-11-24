# FEAT-043: A society's full address and an optional contact phone

**Status:** triaged · **Priority:** P1 · **Owner:** owner / agent · **Opened:** 2026-11-24

**Owner request (2026-11-24):** "in the society creating time, we need to add proper [detailed] address also phone number is optional and we have to make sure we have to get the detailed address from that society."

## Now
A society has only `name` and `city`. Nothing tells an operator or a vendor where the gate actually is.

## Acceptance criteria (draft, firmed up when the item starts)
- AC1. Additive migration: `addressLine1` (building / street), `addressLine2` (area / locality, optional), `landmark` (optional), `state`, `pincode` (6 digits), `contactPhone` (optional, the fixed +91 format from FEAT-031). All nullable in the DB so existing societies keep working.
- AC2. Create requires address line 1, city, state and pincode; edit validates the same way. The phone is optional, and if given it must be a valid Indian mobile number. DTO + class-validator; the shared types are updated.
- AC3. The admin create/edit society form gets the fields (state as a select of Indian states/UTs, pincode numeric), and the society detail page shows the formatted address and phone. Existing societies without an address show "Address missing — add it" on their admin page.
- AC4. Tests (backend integration + web) + gate; V2; V3. The migration is applied to the shared dev DB only with the owner's approval at merge.
