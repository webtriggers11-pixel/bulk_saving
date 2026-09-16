# Plan FEAT-002 — Service catalog per society

**Derived from:** spec.md · **Approved by:** <pending human> on <date>

## Technical approach

Backend: a `catalog` module (Service + ServiceOffering via Prisma), a resident
`GET /catalog` scoped by societyId (JWT), and SUPER_ADMIN management endpoints for the
master services + per-society offerings. Frontend: a resident catalog screen fetching
`GET /catalog` via TanStack Query, rendered with the existing hand-rolled UI primitives.
Seed extended to add master services + enable them for the seeded societies.

## Data model / contracts

**Prisma** (ADR-0009):
- `Service { id, name, slug @unique, description, category String, imageUrl String?, active Boolean @default(true), createdAt, updatedAt }`
- `ServiceOffering { id, societyId FK, serviceId FK, enabled Boolean @default(true), indicativePrice Int?, createdAt, updatedAt, @@unique([societyId, serviceId]) }`

**Shared types:** `ServiceDto` (id, name, slug, description, category, imageUrl?, indicativePrice?).

**Endpoints** (envelope + DTO validation):
- `GET /catalog` (authed resident) → `ServiceDto[]` — enabled offerings ⋈ active services, scoped by JWT societyId.
- `POST /admin/services` (SUPER_ADMIN) → create master service; duplicate slug → `SERVICE_SLUG_TAKEN`.
- `GET /admin/services` (SUPER_ADMIN) → all master services.
- `PATCH /admin/services/:id` (SUPER_ADMIN) → update / toggle active.
- `PUT /admin/societies/:societyId/offerings/:serviceId` (SUPER_ADMIN) → enable/disable + indicativePrice.

**Seed:** add ~5 master services (AC servicing, pest control, deep cleaning, bathroom wash, painting) + enable all for GREEN001 & BLUE0002.

## New decisions required

- **ADR-0009** (Service master + per-society ServiceOffering) — written, Accepted.
- ADR-0003 (multi-tenancy) applies to `GET /catalog` scoping.
- No further ADRs anticipated.

## Risks

- **Tenant leak in catalog:** `GET /catalog` must scope offerings by JWT societyId only —
  mandatory isolation integration test (resident A never sees a B-only offering).
- **Admin endpoints are new SUPER_ADMIN surface:** reuse the FEAT-001 roles guard; test 403 for residents.
- Keep the resident catalog read efficient (single joined query, no N+1).
- Free-text category → UI grouping is best-effort; acceptable per resolved decision 3.

## Task outline (detailed in tasks.md)

Backend: T1 model+migration · T2 shared ServiceDto · T3 catalog service+/catalog+isolation test ·
T4 admin services API · T5 admin offerings API · T6 seed. Frontend: T7 catalog API+query ·
T8 catalog screen+route+empty state · T9 tests. Close: T10 V2 · T11 V3.
