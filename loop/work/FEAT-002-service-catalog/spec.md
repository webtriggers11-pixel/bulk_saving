# FEAT-002 — Service catalog per society

**Status:** specced (open questions resolved) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-16

## Problem / Why

Residents need to see the services available in their society (AC servicing, pest
control, deep cleaning, bathroom wash, painting, …) before they can request/join a
group-buy for one. This feature defines the catalog domain and the resident-facing
list, scoped to the caller's society (ADR-0003). It is the direct prerequisite for
FEAT-003 (group-buy rounds), which starts a round for a specific service in a society.

## User stories

1. As a **resident**, I can browse the services available in my society so I know
   what I can request a group discount for.
2. As a **super-admin**, I can manage the master list of service types and control
   which ones are available to each society.

## Acceptance criteria (testable — this IS the definition of done)

**Domain model**
- [ ] Prisma `Service` (master, platform-wide): id, name, `slug` unique, description,
      category, `imageUrl?`, `active` (bool), timestamps.
- [ ] Prisma `ServiceOffering` (per-society availability): id, `societyId` FK, `serviceId`
      FK, `enabled` (bool), `indicativePrice?` (int, paise/rupees — indicative only, not the
      round price), timestamps, `@@unique([societyId, serviceId])`.
- [ ] Migration applies cleanly.

**Resident catalog (tenant-scoped)**
- [ ] `GET /catalog` (authed) returns the services available to the caller's society —
      i.e. `ServiceOffering.enabled = true` joined to `Service.active = true` — scoped by
      `societyId` from the JWT, never from the request. Returns a clean `ServiceDto[]`
      (+ indicativePrice where set).
- [ ] A resident of Society A never sees a service only offered/enabled in Society B
      (tenant-isolation integration test).

**Super-admin catalog management (backend API)**
- [ ] `POST /admin/services` create a master Service; `GET /admin/services` list;
      `PATCH /admin/services/:id` update / toggle `active` — all restricted to SUPER_ADMIN.
- [ ] `PUT /admin/societies/:societyId/offerings/:serviceId` enable/disable (+ indicativePrice)
      a service for a society — SUPER_ADMIN only.
- [ ] Slug uniqueness enforced; duplicate slug → `SERVICE_SLUG_TAKEN`.

**Frontend (resident PWA)**
- [ ] A `/services` (or home) catalog screen lists the society's available services as
      cards (name, category, indicative price if any, image/icon), fetched via TanStack
      Query from `GET /catalog`. Mobile-first, hand-rolled shadcn-style primitives (ADR-0008).
- [ ] Empty state when the society has no enabled services yet.

**General**
- [ ] DTO + class-validator on every endpoint; standard envelope; DB access only via services.
- [ ] Seed script extended: a few master services + enable them for the seeded societies.
- [ ] `bash scripts/verify.sh` passes (unit + integration incl. the catalog isolation test); TS strict, no `any`.

## Out of scope (explicit, prevents gold-plating)

- Group-buy rounds / requesting a service — that's FEAT-003.
- Super-admin catalog management **UI** — the admin dashboard is FEAT-005; FEAT-002 ships
  the admin **API** + seed only (see open question 2).
- Real service images/upload pipeline — `imageUrl` is a plain string field (point at a static/CDN URL); no upload in v1.
- Pricing logic / tiers — `indicativePrice` is display-only; real round pricing is FEAT-003.

## Resolved decisions (Vivek, 2026-09-16)

1. **Catalog visibility:** per-society enablement via `ServiceOffering` (ADR-0009). Seed
   enables all master services for the seeded societies (zero-friction), curatable later.
2. **Admin scope in v1:** super-admin catalog **API + seed only**; the admin management UI
   ships with the FEAT-005 admin dashboard.
3. **Categories:** **free-text string** on `Service.category` (no enum).
