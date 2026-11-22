# ADR-0046: A platform admin is a society-less `Resident` row (nullable `societyId`)

**Status:** Accepted · **Date:** 2026-11-22 · **Deciders:** owner ("Admin is admin"), agent · **Work item:** FEAT-036 · **Amends:** ADR-0003 (tenant scope), ADR-0023 (admin door), ADR-0044 (user access)

## Context
ADR-0023 made the admin door a phone plus a code, and the admin's society came from their own row. Every row needed a society, so the seed parked the super-admin inside Green Meadows. The owner wants an admin to be just an admin.

## Options
1. **Nullable `Resident.societyId`, allowed only for SUPER_ADMIN** (chosen). One account table, so sessions, refresh, active flags, the WhatsApp door and the Users screen keep working. The type system (`societyId: string | null`) points out every place that assumed a tenant.
2. A separate `Admin` model. It's cleaner in the abstract, but it duplicates auth (OTP scope, refresh keys, `revokeAllSessions`, active flag, Users screen) and splits "grant admin to a resident" (ADR-0044) across two tables. Rejected: much bigger blast radius for the same user-visible result.
3. A hidden "platform" pseudo-society. Rejected: it's a fake tenant that every society list and count would have to filter out forever.

## Decisions
1. `societyId String?`. DB CHECK: `"societyId" IS NOT NULL OR role = 'SUPER_ADMIN'`. A partial unique index on `phone WHERE "societyId" IS NULL`, because the composite `(societyId, phone)` unique doesn't constrain NULLs in Postgres.
2. Tokens carry `societyId: null`. `AuthContext.societyId` is `string | null`. Society-scoped handlers take `@CurrentMember()`, which narrows to a non-null society or answers **403 `NO_SOCIETY`** before the service runs. Tenant scope still comes only from the token (ADR-0003 is unchanged in spirit).
3. Admins created from the console are society-less (`POST /admin/admins`). Granting the role to an existing resident (ADR-0044) stays: that person remains a member of their society too. A society-less admin can't be demoted, because RESIDENT requires a society.
4. The admin door: when a phone has an **active** society-less admin row, sign into it (a switched-off one falls through, V2 P3-1). Otherwise keep the ADR-0023 rule (exactly one admin row).

## Rollback
This one is destructive: every platform admin must first be deleted or moved into a society. Then:
`DROP INDEX "Resident_phone_standalone_key"; ALTER TABLE "Resident" DROP CONSTRAINT "Resident_society_or_admin_check"; ALTER TABLE "Resident" ALTER COLUMN "societyId" SET NOT NULL;`
(The migration's own comment, "SET NOT NULL once no NULL rows exist", is incomplete. Per V2 P3-6, the full steps are recorded here rather than by editing an applied migration.)

## Confidence
**Level:** High. The change is mechanical, and the compiler surfaces every place that has to handle a missing society.

## Research depth
**Judgment call.** Grounded in a full read of the auth module and every `ctx.societyId` call site.

## Revisit trigger
Admin permissions beyond one SUPER_ADMIN role, or a need for admins to be audited separately from residents. Either would argue for option 2.
