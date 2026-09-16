# CHORE-001 — Monorepo scaffold + stack bootstrap

**Status:** specced · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-16

## Problem / Why

The Loop bootstrap has filled STACK.md/CLAUDE.md (docs), but no application code
exists yet. Before any feature can be built, the monorepo must be scaffolded with
the decided stack (ADR-0002, ADR-0005) and `scripts/verify.sh` must be wired to a
real lint+test suite in every layer (framework invariant 3 — a build is not a test).

## Acceptance criteria (testable — this IS the definition of done)

- [ ] pnpm workspace exists with `apps/backend`, `apps/web`, `packages/shared`.
- [ ] `apps/backend` is a running NestJS 11 app (health endpoint returns the standard success envelope).
- [ ] `apps/web` is a running React 19 + Vite PWA (installable manifest + service worker registered).
- [ ] Prisma is initialised in `apps/backend` with a `PrismaService` and a connection to a local Postgres; `prisma migrate` runs cleanly on an empty schema.
- [ ] Redis connectivity is wired (BullMQ can enqueue/consume a trivial test job).
- [ ] `packages/shared` exports at least one shared type consumed by both apps (proves the type-sharing path).
- [ ] Backend has ≥1 real Jest test (unit) + ≥1 integration test (supertest hitting the health endpoint) — both pass.
- [ ] Web has ≥1 real Vitest + RTL test — passes.
- [ ] `bash scripts/verify.sh` runs lint + tests for BOTH apps and exits 0.
- [ ] ESLint (strict, no `any`) + Prettier configured in both apps; `pnpm -r lint` passes.

## Out of scope (explicit, prevents gold-plating)

- No domain models beyond a trivial health/demo slice (societies, rounds, etc. are FEAT-001+).
- No auth, no notifications, no CI/CD deploy (CI test workflow only, optional).
- No production infra / hosting.

## Open questions (agent must ask, never assume)

- Local dev DB/Redis: Docker Compose vs assume locally-installed Postgres/Redis? → **Docker Compose** (ADR-0006), approved by Vivek 2026-09-16.
- Confirm pnpm as the package manager (ADR-0002) is acceptable on the dev machine. → **Yes, pnpm** (v11.10.0 present), approved by Vivek 2026-09-16.
