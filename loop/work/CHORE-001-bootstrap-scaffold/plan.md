# Plan CHORE-001 — Monorepo scaffold + stack bootstrap

**Derived from:** spec.md · **Approved by:** <pending human> on <date>

## Technical approach

Scaffold the pnpm-workspace monorepo per ADR-0002. Backend = NestJS 11 with Prisma
(ADR-0005) + a `PrismaService` and Redis/BullMQ wiring. Web = React 19 + Vite PWA
(`vite-plugin-pwa`) + Tailwind + shadcn/ui + TanStack Query + Zustand. `packages/shared`
holds shared TS types. Wire `scripts/verify.sh` to run lint + tests for both apps.
Keep the demo slice trivial (health endpoint + one shared type) — real domains are FEAT-001+.

## Data model / contracts

- No domain schema yet. Prisma schema starts empty (or a throwaway `HealthPing` model
  proving migrate works), replaced by the real model in FEAT-001.
- Standard API envelope established here so every later endpoint inherits it.

## New decisions required

- **Local dev environment (Docker Compose vs local installs)** for Postgres + Redis
  → propose an ADR once the human answers the open question. Confidence pending.

## Risks

- **Dependency install (ADR requires human approval per CLAUDE.md "Ask the human before").**
  This plan installs many packages — must be approved before execution.
- `vite-plugin-pwa` + shadcn/ui setup can be fiddly; keep the first pass minimal.
- verify.sh must fail loudly if either app's tests are missing (don't let a build masquerade as a test).
