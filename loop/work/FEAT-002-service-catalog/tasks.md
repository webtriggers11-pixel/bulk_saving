# Tasks FEAT-002 — Service catalog per society

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-002): ...`) AND append a LOG.md entry.

## DONE — verify.sh exit 0 (backend 41 / web 16); V2 APPROVE; V3 identical double-run
- [x] T1: Prisma `Service` + `ServiceOffering` (ADR-0009); migration 20260916134455 clean.
- [x] T2: `packages/shared` — `ServiceDto` (+ admin contract types); consumed by both apps.
- [x] T3: `catalog` module — `GET /catalog` scoped by JWT societyId (single joined query); returns-services + tenant-isolation integration tests.
- [x] T4: Admin services API — POST/GET/PATCH /admin/services (SUPER_ADMIN); slug → SERVICE_SLUG_TAKEN; 403-for-resident + 404 tests.
- [x] T5: Admin offerings API — PUT /admin/societies/:societyId/offerings/:serviceId (SUPER_ADMIN, enable/disable + indicativePrice); 403 + 404 tests.
- [x] T6: Seed extended — 5 master services enabled for GREEN001 & BLUE0002; idempotent.
- [x] T7: Catalog API client + `useCatalog` TanStack Query hook.
- [x] T8: `/services` screen — cards (name, category, ₹ price, image), loading/error/empty states; linked from home.
- [x] T9: Frontend tests — list render + empty + error states.
- [x] T10: V2 independent review — APPROVE (no P0/P1; 2 P2 test-assertion gaps then filled → 41 backend tests).
- [x] T11: V3 double-run by closer — both exit 0, identical (backend 41, web 16), not flaky.
