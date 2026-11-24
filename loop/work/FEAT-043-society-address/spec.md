# FEAT-043: A society's full address and an optional contact phone

**Status:** done · **Priority:** P1 · **Owner:** owner / agent · **Opened:** 2026-11-24

**Owner request (2026-11-24):** "in the society creating time, we need to add proper [detailed] address also phone number is optional and we have to make sure we have to get the detailed address from that society."

## Now
A society has only `name` and `city`. Nothing tells an operator or a vendor where the gate actually is.

## Acceptance criteria
- [x] AC1. Additive migration: `addressLine1` (building / street), `addressLine2` (area / locality, optional), `landmark` (optional), `state`, `pincode` (6 digits), `contactPhone` (optional, the fixed +91 format from FEAT-031). All nullable in the DB so existing societies keep working.
- [x] AC2. Create requires address line 1, city, state and pincode; edit validates the same way. The phone is optional, and if given it must be a valid Indian mobile number. DTO + class-validator; the shared types are updated.
- [x] AC3. The admin create/edit society form gets the fields (state as a select of Indian states/UTs, pincode numeric), and the society detail page shows the formatted address and phone. Existing societies without an address show "No address" in the list and "Address missing" on their page; saving Details requires the address. The page has an Address card: the formatted one-line address, the phone as a tel: link, and an Open in Maps link.
- [x] AC4. Tests (backend integration + web) + gate; V2; V3. The migration is applied to the shared dev DB only with the owner's approval at merge.
