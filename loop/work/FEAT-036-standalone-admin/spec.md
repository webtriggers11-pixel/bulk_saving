# FEAT-036: Admin is admin. A platform admin belongs to no society

**Status:** in-progress · **Priority:** P1 · **Owner:** owner (requested: "Admin no need to create society and everything. Admin is admin." → "yes fix this") / agent · **Opened:** 2026-11-22

## Problem
Every account is a `Resident` row with a required `societyId`, so the seeded super-admin `+919999900001` "lives" in Green Meadows, and the only way to make an admin is to grant the role to a resident of some society. To the owner, an administrator is a platform operator, not a member of a society.

## Acceptance criteria
- [ ] AC1 — Migration: `Resident.societyId` becomes nullable. A CHECK constraint allows NULL only for `SUPER_ADMIN`, and a partial unique index makes a phone unique among society-less rows. Existing rows are untouched; rolling back is `SET NOT NULL` once no NULL rows exist.
- [ ] AC2 — A society-less admin signs in at the admin door (OTP and WhatsApp), refreshes, and uses every `/admin/*` endpoint. The token carries `societyId: null`.
- [ ] AC3 — Society-only endpoints (rounds, ratings, catalog, asks, push, `GET /residents/:id`) answer **403 `NO_SOCIETY`** to a society-less account and never touch data. `GET /me` works and returns `society: null`.
- [ ] AC4 — `POST /admin/admins {phone, name?}` creates a society-less admin. 409 if a society-less account with that phone already exists. If the phone is a resident of a society, the 409 says to grant the role on that row instead.
- [ ] AC5 — Guards: a society-less admin can't be demoted to RESIDENT (409, there's no society to be a resident of). The existing self and last-admin guards still apply. The admin door prefers the society-less admin row when a phone has one.
- [ ] AC6 — Seeds: `+919999900001` and the demo "Ops Admin" `+919999900209` are society-less admins. `TEST_LOGINS.md` updated.
- [ ] AC7 — Web: the Users list and detail show "Platform admin" where the society would be (no society link). The Users page has "Add admin" (phone with fixed +91, name). A society-less admin who opens a resident page is sent to `/admin`.
- [ ] AC8 — Tests + gate; V2; V3.

## Non-goals
Separate `Admin` table/model (rejected in ADR-0046). Admin roles/permissions beyond SUPER_ADMIN.
