# Tasks FEAT-002 — Service catalog per society

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-002): ...`) AND append a LOG.md entry.

## Backend
- [ ] T1: Prisma `Service` + `ServiceOffering` (ADR-0009); migration applies clean. — depends: —
- [ ] T2: `packages/shared` — `ServiceDto`; consumed by backend. — depends: T1
- [ ] T3: `catalog` module — `CatalogService` + `GET /catalog` (authed) scoped by JWT societyId; enabled offerings ⋈ active services. Integration tests: returns society's services + tenant-isolation (A can't see B-only offering). — depends: T2
- [ ] T4: Admin services API — `POST/GET/PATCH /admin/services` (SUPER_ADMIN); slug-unique → `SERVICE_SLUG_TAKEN`. Integration tests incl. 403 for resident. — depends: T3
- [ ] T5: Admin offerings API — `PUT /admin/societies/:societyId/offerings/:serviceId` (SUPER_ADMIN, enable/disable + indicativePrice). Integration test. — depends: T4
- [ ] T6: Extend seed — ~5 master services + enable for GREEN001 & BLUE0002; idempotent. — depends: T1

## Frontend (resident PWA)
- [ ] T7: Catalog API client + TanStack Query hook (`GET /catalog`). — depends: T3
- [ ] T8: Catalog screen (`/services` or home) — service cards (name, category, indicative price, image), empty state; mobile-first, hand-rolled primitives (ADR-0008); route wired + linked from authed home. — depends: T7
- [ ] T9: Frontend tests (Vitest + RTL) — catalog renders list (mocked API) + empty state. — depends: T8

## Close
- [ ] T10: V2 independent review (reviewer runs verify.sh itself + audits vs spec/ARCHITECTURE; catalog tenant-isolation scrutiny). — depends: T1–T9
- [ ] T11: V3 fresh double-run of verify.sh; log both; close (REGISTRY → done, commit). — depends: T10
