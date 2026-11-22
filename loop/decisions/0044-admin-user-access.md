# ADR-0044: Super-admins manage every resident's name, role and membership, with self and last-admin guards

**Status:** Accepted · **Date:** 2026-11-22 · **Deciders:** owner ("as admin i want all access also users access right"), agent · **Work item:** FEAT-033 · **Builds on:** ADR-0003, ADR-0023, ADR-0024

## Confidence
**Level:** High.

## Research depth
**Judgment call.**

## Decisions
1. `GET /admin/residents` is the second explicit cross-tenant read (after `GET /admin/societies`). It is SUPER_ADMIN-guarded and paginated (FEAT-025).
2. **Access rights = the existing two roles** (`RESIDENT | SUPER_ADMIN`). No new permission model: BRIEF non-goal #3 keeps
   society-level admins out of v1.
3. **Guards:** an admin can't change their own role or delete themselves, and the last SUPER_ADMIN can't be demoted or deleted (409 CONFLICT).
   Without these, one tap locks everyone out of the admin door (ADR-0023).
4. **Role changes** take effect at the next token refresh: refresh re-reads the role from the database, so within one `JWT_ACCESS_TTL_SECONDS`.
   Deleting a resident revokes all their sessions (`revokeAllSessions`).
5. **Delete cascades** to that resident's pledges, ratings, asks, notifications and push devices (schema `onDelete: Cascade`). The confirm sheet says so.
   Round unit counts are maintained by `RoundService`, so deleting a resident with a pledge in an OPEN round is refused (409). Withdraw first.

## Revisit trigger
Society-level admins; or an audit-log requirement for admin actions.
