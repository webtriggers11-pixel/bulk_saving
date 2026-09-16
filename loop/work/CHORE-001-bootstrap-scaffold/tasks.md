# Tasks CHORE-001 — Monorepo scaffold + stack bootstrap

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`chore(CHORE-001): ...`) AND append a LOG.md entry.

> ⚠️ BLOCKED pending human approval: every task below installs dependencies.
> `CLAUDE.md` → "Ask the human before adding any dependency." Do not start until approved.

- [ ] T1: Init pnpm workspace root (`pnpm-workspace.yaml`, root `package.json`, base `tsconfig`, `.gitignore`).
- [ ] T2: Scaffold `apps/backend` NestJS 11 app + health endpoint returning the standard success envelope — depends: T1.
- [ ] T3: Add Prisma to backend (`PrismaService`, empty/throwaway schema, `prisma migrate` on local Postgres) — depends: T2.
- [ ] T4: Wire Redis + BullMQ in backend (trivial enqueue/consume proven by a test) — depends: T2.
- [ ] T5: Scaffold `apps/web` React 19 + Vite PWA (`vite-plugin-pwa` manifest + SW) — depends: T1.
- [ ] T6: Add Tailwind + shadcn/ui + TanStack Query + Zustand to web (one demo screen) — depends: T5.
- [ ] T7: Create `packages/shared` with one shared type consumed by both apps — depends: T2, T5.
- [ ] T8: Backend tests — 1 Jest unit + 1 supertest integration (health endpoint) — depends: T2.
- [ ] T9: Web tests — 1 Vitest + RTL test — depends: T6.
- [ ] T10: ESLint (strict, no `any`) + Prettier in both apps; `pnpm -r lint` green — depends: T2, T6.
- [ ] T11: Wire `scripts/verify.sh` to run lint + tests for BOTH apps; exits 0 — depends: T8, T9, T10.
- [ ] T12 (optional): GitHub Actions workflow running `bash scripts/verify.sh` on push — depends: T11.
