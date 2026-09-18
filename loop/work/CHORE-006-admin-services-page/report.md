# CHORE-006 — The admin has no services page

**Status:** triaged · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-18

## What is missing

The super-admin can manage vendors, rounds and payments in the UI, but **not the service
catalog**. `apps/web/src/features/admin/` has no services page, and `admin.api.ts` exposes
only `GET /admin/services` (used to fill the new-round dropdown). Creating a master service,
editing one, toggling `active`, or setting the FEAT-010 unit labels can only be done by
calling the API directly.

Found by the FEAT-010 V2 review: that spec claimed "the service form has label / plural /
scope fields" and the task was ticked, but no such form exists. The AC was corrected rather
than quietly ticked, and the real gap is recorded here.

## Why it matters

"Services are data, not code" (ADR-0009) is only true in practice if the owner can edit that
data. Today, adding a service needs a developer with a bearer token — which makes the catalog
effectively code.

## Scope when taken

UI only: `POST`/`PATCH /admin/services` already exist and are validated, including the
FEAT-010 unit-label pairing rule. Needs a services list, a create form, inline edit, an
active toggle, and the three unit fields with the 16 / 140 caps mirrored client-side — the
caps cannot be imported from `@bulk/shared` at runtime in web code (CHORE-004), so they need
the `rating-cap.test.ts` pinning pattern.

## Not urgent because

The five seeded services cover the pilot, and the owner has not asked to add one.
