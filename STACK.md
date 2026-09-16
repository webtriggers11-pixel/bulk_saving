# STACK.md — the stack contract

> Filled by bootstrap (run manually 2026-09-16). This file is the single place
> where the stack is defined; everything else in the repo is stack-agnostic.

## Stack

- **Frontend:** React 19 + Vite 6, PWA via `vite-plugin-pwa` · Tailwind CSS + hand-rolled shadcn-style UI primitives (ADR-0008; shadcn CLI may be adopted later) · TanStack Query (server state) + Zustand (UI state) · TypeScript strict
- **Backend:** NestJS 11 on Node 20 LTS · TypeScript strict · Prisma 6 ORM
- **Database:** PostgreSQL 16 (source of truth) · Redis 7 (cache, OTP TTL, BullMQ queues)
- **Package manager:** pnpm (workspaces monorepo)
- **Test frameworks:** Backend — Jest + supertest (unit + integration against a test DB). Frontend — Vitest + React Testing Library. E2E deferred (v1).

## Commands

| Action        | Command                     |
|---------------|-----------------------------|
| Install       | `pnpm install`              |
| Dev (backend) | `pnpm --filter backend dev` |
| Dev (web)     | `pnpm --filter web dev`     |
| Build         | `pnpm -r build`             |
| Verify (all)  | `bash scripts/verify.sh`    |
| Lint          | `pnpm -r lint`              |
| Infra up      | `docker compose up -d`      |
| Infra down    | `docker compose down`       |

> **Dev infra (Docker Compose, ADR-0006):** Postgres 16 + Redis 7. Host ports are
> remapped — **Postgres `localhost:5442`, Redis `localhost:6399`** (5432/6379 were
> occupied on the dev machine). Connection strings live in `.env` / `apps/backend/.env`
> (both gitignored; see `.env.example`). Integration tests require infra to be up.

> Dev/build commands become live once CHORE-001 scaffolds the apps. `verify.sh`
> is wired to real lint+test during CHORE-001 — until then it exits non-zero by design.

## Layout

```
apps/backend/   NestJS API — modules by domain (auth, societies, residents, catalog,
                rounds, jobs, vendors, notifications, admin); Prisma; Jest tests
apps/web/       React + Vite PWA — feature-based (rounds, catalog, auth, admin, profile)
packages/shared/  shared TS types (DTOs, enums, round-state types)
```

## Researched on

2026-09-16 — decisions recorded as ADR-0002..0005. Re-examine stack skills and
versions periodically against current best practices.
