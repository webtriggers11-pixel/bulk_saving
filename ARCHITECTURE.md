# ARCHITECTURE — Bulk Saving

> How everything gets built. `SPEC.md` defines *what*; this defines *how*.
> Every task Phase 1→3 is measured against this. `review:` uses it to detect drift.
> Decided during `architect:` — 2026-09-16.

---

## Project type & stack

**Type:** Full-stack web app — React PWA frontend + NestJS API backend.

| Layer | Choice | Version target |
|-------|--------|----------------|
| Frontend | **React + Vite** (PWA via `vite-plugin-pwa`) | React 19, Vite 6 |
| Backend | **NestJS** | Nest 11 |
| Database | **PostgreSQL** | 16+ |
| ORM | **Prisma** | 6.x |
| Cache / queue | **Redis** + **BullMQ** | Redis 7 |
| Auth | phone + OTP, JWT (access + refresh), role-based | — |
| Notifications | SMS-first adapter, WhatsApp adapter fast-follow | — |
| UI | **Tailwind CSS + hand-rolled shadcn-style primitives** (ADR-0008) | — |
| Server state | **TanStack Query** | — |
| Client state | **Zustand** (auth/UI only) | — |
| Language | **TypeScript, strict, no `any`** (both apps) | TS 5.x |

> ⚠️ **Do NOT scaffold with alternatives.** This project is React+Vite (NOT
> Next.js / CRA) and NestJS (NOT Express/Fastify bare). Do NOT swap Prisma for
> TypeORM, Tailwind for another CSS system, or add a state library beyond
> TanStack Query + Zustand without an ADR/DECISIONS.md entry.

---

## Folder structure

Monorepo. Aligns with `CLAUDE.md`'s `apps/<layer>/` contract.

```
bulk_saving/
├── apps/
│   ├── backend/                 # NestJS API
│   │   ├── src/
│   │   │   ├── modules/         # domain modules (feature-based)
│   │   │   │   ├── auth/        # phone+OTP, JWT, guards, roles
│   │   │   │   ├── societies/   # tenant entity + membership
│   │   │   │   ├── residents/   # resident profiles
│   │   │   │   ├── catalog/     # services offered per society
│   │   │   │   ├── rounds/      # group-buy rounds + state machine
│   │   │   │   ├── jobs/        # assigned/delivered jobs + ratings
│   │   │   │   ├── vendors/     # minimal vendor list (admin-managed)
│   │   │   │   ├── notifications/ # channel interface + adapters + queue
│   │   │   │   └── admin/       # super-admin dashboard endpoints
│   │   │   ├── common/          # filters, interceptors, decorators, pipes
│   │   │   ├── prisma/          # PrismaService, module
│   │   │   └── main.ts
│   │   ├── prisma/schema.prisma
│   │   └── test/                # Jest integration (supertest + test DB)
│   └── web/                     # React PWA
│       ├── src/
│       │   ├── features/        # feature-based: rounds/, catalog/, auth/, admin/, profile/
│       │   │   └── <feature>/   # components, hooks, api, types co-located
│       │   ├── components/ui/   # hand-rolled shadcn-style primitives (ADR-0008)
│       │   ├── lib/             # api client, query client, utils
│       │   ├── stores/          # zustand (auth, ui)
│       │   └── main.tsx
│       └── ...
├── packages/
│   └── shared/                  # shared TS types (DTOs, enums, round states)
├── BRIEF.md
├── ARCHITECTURE.md
└── vibe/
```

---

## Multi-tenancy model

**Shared database, shared schema, `societyId` on every tenant-scoped row.**

- Every tenant-scoped table (`Round`, `Job`, `ServiceOffering`, resident membership)
  carries `societyId`. Global tables (`Service` catalog master, `Vendor`) may be shared.
- **Isolation is enforced at the service/repository layer** — a resident's requests
  are always scoped to their society via the authenticated context, never trusted from
  client input. Super-admin can query across societies explicitly.
- NOT schema-per-tenant (overkill for MVP, painful migrations). This design scales to
  many societies and later multi-city (add `cityId`/`regionId`) without re-architecting.

**Rule:** no query touching a tenant-scoped table runs without a `societyId` filter
(or an explicit, authorised cross-tenant admin path).

---

## Round lifecycle — explicit state machine

The core domain object. **All transitions live in `RoundService`. No status field is
mutated anywhere else.**

```
                 ┌─────────────► CANCELLED (admin, any pre-delivery state)
                 │
OPEN ──deadline reached, threshold met──►  CLOSED_MET ──► ASSIGNED ──► DELIVERED ──► RATED
  │
  └──deadline reached, threshold NOT met──► CLOSED_EXPIRED
```

- **OPEN:** residents join/leave, units accumulate, current tier + price recompute live.
- **CLOSED_MET / CLOSED_EXPIRED:** decided by the scheduled closer at the deadline.
- **ASSIGNED:** super-admin sets vendor + final negotiated price (manual).
- **DELIVERED:** super-admin marks job done + payment collected (manual flag, no gateway).
- **RATED:** resident submits 1–5 rating (feeds success metric + vendor accountability).
- **CANCELLED:** admin action; guarded, only from pre-delivery states.

Deadlines are driven by a **BullMQ delayed job per round**; a `RoundCloserProcessor`
performs the terminal OPEN→CLOSED_* transition inside a DB transaction.

---

## Concurrency model (the critical path)

Joining a round increments a **unit** count that can cross a **tiered price threshold**.
Concurrent joins must never oversell a tier or miscount.

- **PostgreSQL is the single source of truth for counts.** Joins use an atomic
  `prisma.$transaction` with `round.update({ where: { id, status: 'OPEN' }, data: { units: { increment: qty } } })`,
  then tier/price recomputed from the returned count inside the same transaction.
- **Redis is for display + rate-limiting only** — live counter reads, OTP throttling.
  Redis is never the authority for units, tier, or state.
- Thresholds count **units, not people** (one resident may request N units).
- Price = highest tier whose threshold is met by current units.

---

## Auth & roles

- **Phone + OTP.** OTP generated server-side, stored in **Redis with TTL + attempt
  rate-limiting**, never returned to the client, never logged.
- **Onboarding:** society invite code binds resident → society, then OTP verifies phone.
- **JWT access + refresh.** Access short-lived; refresh rotation.
- **Roles:** `RESIDENT | SUPER_ADMIN` — enum extensible to `VENDOR`, `SOCIETY_ADMIN`.
  Enforced via Nest guards + a `@Roles()` decorator.
- Tenant context (`societyId`) is derived from the authenticated resident, never
  accepted from the request body for tenant-scoped reads/writes.

---

## Notifications

- One `NotificationChannel` interface (`send(to, template, data)`).
- **SMS adapter ships first** (OTP + round alerts). **WhatsApp adapter is a
  fast-follow** behind the same interface — no caller changes when it lands.
- All non-OTP sends are **queued via BullMQ** (retryable, non-blocking).
- OTP SMS may send synchronously with strict rate-limiting.

---

## Backend conventions

- **Modular by domain** (see folder tree). One module = one bounded concern.
- **Service layer holds business logic.** Controllers are thin: validate → delegate → shape response.
- **Validation:** DTOs + `class-validator` + global `ValidationPipe` (`whitelist: true`).
- **Error envelope (enforced by a global exception filter):**
  ```json
  { "success": false, "error": { "code": "ROUND_CLOSED", "message": "This round is no longer open." } }
  ```
  Success responses: `{ "success": true, "data": ... }`.
- **DB access only through Prisma via `PrismaService`** — no raw SQL scattered in controllers.
- Config via `@nestjs/config`, validated env schema. **No secrets in code.**

---

## Frontend conventions

- **Feature-based folders** — components, hooks, api calls, and types co-located per feature.
- **Server state = TanStack Query.** Client/UI state = Zustand (auth, ephemeral UI only).
  Do not duplicate server data into Zustand.
- **TypeScript strict, no `any`.** Shared DTO/enum types imported from `packages/shared`.
- **UI:** Tailwind + hand-rolled shadcn-style primitives (ADR-0008). Mobile-first. Round cards make count/deadline/price/urgency vivid.
- **PWA:** `vite-plugin-pwa` service worker; installable; graceful on flaky connections.

---

## Testing philosophy

Every task ships with a test. What is tested matters more than coverage %.

| Level | Scope | Tool |
|-------|-------|------|
| Unit | pure logic: tier/price calc, state-machine transitions, OTP rules | Jest (be) / Vitest (fe) |
| Component | user interactions, conditional render (join flow, round card) | Vitest + React Testing Library |
| Integration | API endpoints against a real test DB (auth, join race, round close) | Jest + supertest |
| E2E | **skipped for v1** (revisit for the join→deliver→rate happy path later) | — |

**Mandatory coverage targets:** the concurrency join path and every round state
transition MUST have integration tests — this is the highest-risk code.

---

## Code quality & git

- **ESLint strict** — `no-any`, `no-unused-vars`, `react-hooks/exhaustive-deps`.
- **Prettier** — single quotes, semicolons, 2-space indent, 100-char lines.
- **Conventional commits** — `feat(rounds):`, `fix(auth):`, `docs(...)`, `chore(...)`.
  Doc commits separate from code commits.
- **Dependencies:** pinned exact versions; `npm audit` before commit; prefer well-maintained packages.
- **Pre-commit hooks:** lint + tests must pass before commit.

---

## Boundaries (three-tier)

### Always
- Scope every tenant query by `societyId`.
- Route all round state changes through `RoundService`.
- Validate every request body with a DTO before logic runs.
- Return the standard success/error envelope.
- Write a test for every task; cover the concurrency + state-transition paths.

### Ask first (human approval required — see CLAUDE.md)
- Adding any dependency.
- Any DB migration, schema change, or storage-format change.
- Deleting files or dropping/altering tables.
- Anything that costs money (SMS/WhatsApp provider, hosting, deploy).
- Introducing a new architectural pattern not in this document.

### Never (P0 — build-breaking / unsafe)
- **Never commit secrets** (API keys, JWT secrets, DB creds, OTP provider keys).
- Never mutate a round `status` outside `RoundService`.
- Never treat Redis as the source of truth for unit counts or round state.
- Never trust `societyId` (or role) from the client for tenant-scoped access.
- Never return or log raw OTP codes.
- Never bypass DTO validation or the error envelope.
- Never use `any` or disable strict TypeScript to "make it compile".
- Never call Prisma directly from a controller — go through a service.

---

## Architecture decisions log

| # | Decision | Reason |
|---|----------|--------|
| A1 | Monorepo `apps/backend` + `apps/web` + `packages/shared` | Shared types, matches CLAUDE.md `apps/<layer>/` |
| A2 | Shared-schema multi-tenancy via `societyId` | Scales to many societies/multi-city without schema-per-tenant pain |
| A3 | Postgres authoritative for counts; Redis display-only | Prevents tier over-sell / miscount under concurrent joins |
| A4 | Round lifecycle as explicit state machine in `RoundService` | Keeps the core domain coherent through a fast build |
| A5 | Prisma over TypeORM | Type safety + migration DX for a small team MVP |
| A6 | Thresholds count units, not people; tiered pricing | Matches vendor economics + recruit-a-neighbour incentive |
| A7 | `NotificationChannel` interface, SMS-first / WhatsApp fast-follow | WhatsApp API approval never blocks the 4–6 week launch |
| A8 | TanStack Query (server) + Zustand (UI) | Clear split; avoids state duplication |
| A9 | BullMQ delayed jobs for round closing | Reliable deadline-driven transitions |

---

## Changelog
- **2026-09-16** — Initial architecture established from BRIEF.md (`architect:`).
