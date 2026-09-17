# FEAT-005 — Super-admin dashboard (demand, assign vendor, deliver, payments)

**Status:** specced (autonomous) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-17

## Problem / Why

Rounds now fill and close on their own (FEAT-003/004), but nobody can act on the pooled
demand. The founder (super-admin) needs one place to see demand across societies, turn a
CLOSED_MET round into a real job (pick a vendor, record the negotiated price), mark it
delivered, and track manual payment collection per resident. The admin can already open,
close and cancel rounds, but only through the API; this adds the UI. Without this feature
the core loop cannot finish.

## Decisions baked in (ADR-0012)

- **Minimal global vendor list**: name, phone, optional category and notes, active flag.
  Global, not society-scoped: vendors serve a city. Admin-managed, and vendors have no login (BRIEF non-goal).
- **Assignment data lives on the Round** (1:1): `vendorId`, `finalPrice` (integer ₹ per unit),
  `assignedAt`, `deliveredAt`. No separate Job table in v1.
- **Payments are per participant**: `RoundParticipant.paymentCollectedAt` (null means not collected).
  Amount due = `finalPrice × units`. It is a manual flag with no gateway (BRIEF non-goal), and the admin can undo it.
- Status moves still go ONLY through `RoundsService.transition()`: assign writes vendor, price and
  `assignedAt` in the same guarded, row-locked write; deliver writes `deliveredAt`.
- The admin UI lives in the same React PWA under `/admin/*`, gated to SUPER_ADMIN.

## User stories

1. As a super-admin, I see a dashboard with round counts by status, demand pledged per society,
   and payment totals, so I know where to act.
2. As a super-admin, I list rounds across societies filtered by status and society, and open a round's detail.
3. As a super-admin, I open a new round (society, service, deadline, tiers) from the UI.
4. As a super-admin, I close or cancel a round from its detail page.
5. As a super-admin, I assign a CLOSED_MET round to a vendor with the negotiated final price.
6. As a super-admin, I mark an ASSIGNED round delivered.
7. As a super-admin, I mark each participant's payment collected (or undo it), with amounts shown.
8. As a super-admin, I manage the vendor list (add, edit, deactivate).

## Acceptance criteria

**Backend (all under `/admin/*`, SUPER_ADMIN only; a resident token gets 403)**
- [ ] Migration: `Vendor` table; Round gets `vendorId?` (FK, restrict), `finalPrice?`, `assignedAt?`, `deliveredAt?`; RoundParticipant gets `paymentCollectedAt?`. Applies cleanly to existing data.
- [ ] `GET/POST /admin/vendors`, `PATCH /admin/vendors/:id`: validated DTOs (name 1–100 chars, phone digits/+ 8–15 chars); unknown id gets 404.
- [ ] `GET /admin/societies` returns every society (id, name, city, inviteCode).
- [ ] `GET /admin/dashboard` returns `statusCounts` (all 7 statuses, zeros included), `demandBySociety` (open rounds, units pledged, distinct residents joined in OPEN rounds), and `payments` (`collectedAmount` / `outstandingAmount` over ASSIGNED/DELIVERED/RATED rounds).
- [ ] `GET /admin/rounds?status=&societyId=` lists summaries across societies, newest first: society, service, status, units, participants, current price, deadline, vendor, final price, payment summary. An invalid status gets 400.
- [ ] `GET /admin/rounds/:id` returns the detail plus participants (resident name and phone, units, payment state, amount due). Unknown id gets 404.
- [ ] `POST /admin/rounds/:id/assign {vendorId, finalPrice}`: CLOSED_MET → ASSIGNED, storing vendor, price and assignedAt atomically in the guarded transition. From any other status: 409 INVALID_ROUND_TRANSITION, with nothing written. Unknown vendor gets 404; an inactive vendor gets 400 VENDOR_INACTIVE; finalPrice must be an integer 1–1,000,000.
- [ ] `POST /admin/rounds/:id/deliver`: ASSIGNED → DELIVERED and sets deliveredAt. From any other status: 409.
- [ ] `PUT /admin/rounds/:roundId/participants/:participantId/payment {collected}` sets or clears paymentCollectedAt. Allowed only when the round is ASSIGNED/DELIVERED/RATED (otherwise 409 PAYMENT_NOT_ALLOWED). A participant of a different round gets 404. Idempotent.
- [ ] Integration tests cover each endpoint's happy path, 403, 404, and the illegal-state 409s. The dashboard aggregates are asserted on a society fixture scoped to the test.

**Frontend (`apps/web`, `/admin/*`)**
- [ ] `AdminRoute` guard: SUPER_ADMIN sees admin pages; a resident is redirected to `/`; unauthenticated users go to `/onboard`. Home shows an "Admin dashboard" link for super-admins only.
- [ ] `/admin`: status count tiles, demand by society, payment totals, and a rounds table with status and society filters linking to the detail page.
- [ ] `/admin/rounds/new`: form (society select, service select, deadline, dynamic tier rows) → POST; backend error messages are shown.
- [ ] `/admin/rounds/:id`: details, participants with payment toggles and amounts, and actions valid for the current status only (Close when OPEN; Assign form when CLOSED_MET, with active vendors and a final price; Deliver when ASSIGNED; Cancel with an inline confirm step before DELIVERED).
- [ ] `/admin/vendors`: list, add form, edit inline, activate/deactivate.
- [ ] TanStack Query hooks with invalidation after mutations; TS strict, no `any`; loading/error/empty states.
- [ ] Vitest + RTL tests: AdminRoute redirects, dashboard render, round detail (assign call args, action visibility per status, payment toggle), vendors create, new-round submit.

**General**
- [ ] `bash scripts/verify.sh` passes. No new dependencies.

## Out of scope

- Resident "My Requests" history and resident rating (FEAT-007). Notifications on assign/deliver (FEAT-006).
- Editing a round's deadline or tiers after opening; per-society offering management UI (API exists from FEAT-002).
- Pagination (v1 caps lists at 200 rows); CSV export; charts.
- Vendor login or portal; payment gateway (BRIEF non-goals).

## Open questions

- None blocking. Revisit ADR-0012 if one round ever needs several vendors, or if payment must be recorded at the round level instead of per resident.
