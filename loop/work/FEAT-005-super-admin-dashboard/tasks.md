# Tasks FEAT-005: Super-admin dashboard

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task or chunk: commit (`feat(FEAT-005): ...`) AND append a LOG.md entry.

## Contract (done by the orchestrator before the parallel build)
- [x] T2: `packages/shared` admin DTOs (VendorDto, Create/UpdateVendorBody, AdminSocietyDto, AdminRoundSummaryDto, AdminRoundDetailDto, AdminRoundParticipantDto, AssignRoundBody, SetPaymentBody, AdminDashboardDto). — depends: —

## Backend chunk
- [x] T1: Prisma Vendor + Round assignment columns + participant paymentCollectedAt; migration clean. — depends: T2
- [x] T3: vendors module: GET/POST/PATCH /admin/vendors (DTO validation, 404). — depends: T1
- [x] T4: GET /admin/societies; GET /admin/rounds (filters, summary mapper, 200 cap); GET /admin/rounds/:id (participants); GET /admin/dashboard aggregates. — depends: T1
- [x] T5: RoundsService assign (CLOSED_MET→ASSIGNED + vendor/price/assignedAt in the guarded tx; VENDOR_INACTIVE / 404 vendor) and deliver (ASSIGNED→DELIVERED + deliveredAt); POST endpoints. — depends: T3, T4
- [x] T6: PUT payment flag under the row lock; PAYMENT_NOT_ALLOWED; participant-in-round check. — depends: T4
- [x] T7: Integration tests for T3–T6 (happy path, 403, 404, 409 with nothing written, dashboard aggregates scoped to fixtures). — depends: T3–T6

## Frontend chunk
- [x] T8: features/admin: admin.api.ts + useAdmin hooks (query keys, invalidation); AdminRoute; AdminLayout nav; routes in App.tsx; Home link for SUPER_ADMIN. — depends: T2
- [x] T9: AdminDashboardPage: status tiles, demand by society, payment totals, rounds table with status and society filters. — depends: T8
- [x] T10: AdminRoundDetailPage: details, participants plus payment toggles and amounts, status-dependent actions (close / assign form / deliver / cancel with inline confirm). — depends: T8
- [x] T11: AdminVendorsPage (list/add/edit/activate) + AdminNewRoundPage (society/service selects, deadline, tier rows). — depends: T8
- [x] T12: Vitest + RTL tests: AdminRoute, dashboard, round detail (assign args, action visibility, payment toggle), vendors create, new-round submit. — depends: T9–T11

## Close
- [x] T13: V2 independent review (backend + frontend); the reviewer runs verify.sh itself. — depends: T1–T12
- [x] T14: V3 fresh double run of verify.sh; log both; close (REGISTRY → done, HANDOFF, commit). — depends: T13

## V2 outcome
- Backend reviewer: APPROVE (verify exit 0; backend 192 / web 50). Frontend reviewer: APPROVE (verify + web build exit 0).
- P2s fixed before close:
  - backend: PATCH vendor null for name/phone/active → 400 (was 500);
  - cancel blocked with 409 PAYMENTS_COLLECTED while any payment is collected (payments on a CANCELLED round would become invisible);
  - vendor row share-locked during assign;
  - frontend: round mutations invalidate on settle (a 409 refetches the stale round);
  - vendor edits refresh rounds that embed the vendor;
  - Cancel disabled while an assign is in flight.

## P2 follow-ups (not blocking; triage as CHORE)
- Dashboard aggregates load every participant of OPEN and payable rounds into memory; move to SQL aggregation before volumes grow.
- A stale action error stays visible after a later successful action (reset mutations on success or status change).
- Client-side checks: vendor category ≤100 and notes ≤500; the new-round deadline input has no `min` or future check.
- Detail page tests don't cover CLOSED_EXPIRED, RATED or CANCELLED.
- 12 act() warnings in AdminRoute.test / HomePage.test (store logout while mounted).
- The admin role is read from the persisted login snapshot, so a role change needs a fresh login (the server still enforces it).
- `TransitionData` is restricted at compile time only; consider a runtime pick of allowed keys.
- Dev DB only: the `_prisma_migrations` table holds a rolled-back FEAT-004 attempt, so `prisma migrate dev` asks for a reset. Committed migrations are consistent (verified against a shadow DB). Fix needs human approval: delete that row, or reset the dev DB.
