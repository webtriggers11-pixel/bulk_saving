# Plan FEAT-005: Super-admin dashboard

**Derived from:** spec.md · **Approved by:** autonomous (owner directive), 2026-09-17

## Technical approach

Backend: a new `vendors` module (admin CRUD); a societies admin list; admin read models for rounds
(summary, detail, dashboard aggregates) in `RoundsAdminService`; assign and deliver as guarded
transitions in `RoundsService` (transition() takes optional extra data); the payment flag in
`RoundsService` under the round row lock. Frontend: `features/admin/` with its own API, hooks and pages,
an `AdminRoute` guard, and an admin layout with a nav. Shared DTOs are defined first (T2) so backend and
frontend can be built in parallel against a fixed contract.

## Data model

- `Vendor { id, name, phone, category?, notes?, active=true, createdAt, updatedAt }`, global.
- `Round += vendorId? (FK Vendor, onDelete Restrict), finalPrice? Int, assignedAt?, deliveredAt?`, plus index (status).
- `RoundParticipant += paymentCollectedAt?`.
- Error codes: `VENDOR_INACTIVE`, `PAYMENT_NOT_ALLOWED`.

## Endpoints (SUPER_ADMIN)

| Method | Path | Returns |
|---|---|---|
| GET | /admin/dashboard | AdminDashboardDto |
| GET | /admin/societies | AdminSocietyDto[] |
| GET | /admin/rounds?status&societyId | AdminRoundSummaryDto[] (max 200, newest first) |
| GET | /admin/rounds/:id | AdminRoundDetailDto |
| POST | /admin/rounds/:id/assign | AdminRoundDetailDto |
| POST | /admin/rounds/:id/deliver | AdminRoundDetailDto |
| PUT | /admin/rounds/:roundId/participants/:participantId/payment | AdminRoundParticipantDto |
| GET/POST | /admin/vendors | VendorDto[] / VendorDto |
| PATCH | /admin/vendors/:id | VendorDto |

Existing: POST /admin/rounds (open), /:id/close, /:id/cancel (return RoundDto; the UI refetches).

## Frontend routes

`/admin` dashboard · `/admin/rounds/new` · `/admin/rounds/:id` · `/admin/vendors`. The existing
`GET /admin/services` supplies the service select in the new-round form.

## New decisions

- **ADR-0012** (written, Accepted).

## Risks

- **Transition + data atomicity:** assign must not write vendor or price if the transition is illegal. Validate inside the locked tx before the update, and test that nothing is written on 409.
- **Aggregate correctness** (dashboard totals) under a shared test DB: scope assertions to fixture societies. The global statusCounts are asserted only as ≥ fixture counts.
- **Parallel build contract drift:** shared types are frozen in T2 before the builders start; any change must go through `packages/shared`.
- **PII:** resident phones are exposed only on SUPER_ADMIN endpoints. Never log them.

## Task outline

T1 migration · T2 shared DTOs · T3 vendors API · T4 societies list + admin round reads + dashboard · T5 assign/deliver transitions · T6 payment flag · T7 backend integration tests (spread across T3–T6) · T8 admin API client + hooks + AdminRoute + layout · T9 dashboard + rounds table · T10 round detail actions + payments · T11 vendors page + new-round form · T12 frontend tests · Close: T13 V2 · T14 V3.
