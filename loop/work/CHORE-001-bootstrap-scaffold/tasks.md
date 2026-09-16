# Tasks CHORE-001 — Monorepo scaffold + stack bootstrap

Dependency-ordered. Checked when `bash scripts/verify.sh` passed.
Completed 2026-09-16. Commit: `efd1526`. All three verification checkpoints green.

- [x] T1: Init pnpm workspace root (`pnpm-workspace.yaml`, root `package.json`, base `tsconfig`, `.gitignore`, `docker-compose.yml`).
- [x] T2: Scaffold `apps/backend` NestJS 11 + /health endpoint returning the standard success envelope.
- [x] T3: Add Prisma to backend (`PrismaService`, `HealthPing` schema, `prisma migrate dev --name init` on local Postgres — clean).
- [x] T4: Wire Redis + BullMQ (demo queue enqueue/consume proven by an integration test against real Redis).
- [x] T5: Scaffold `apps/web` React 19 + Vite PWA (`vite-plugin-pwa` manifest + SW; icons 192/512 + maskable — installable).
- [x] T6: Tailwind + shadcn/ui + TanStack Query + Zustand (demo screen: health query + counter store).
- [x] T7: `packages/shared` with `ApiResponse`/`ApiError`/`HealthStatus`, imported by both apps.
- [x] T8: Backend tests — Jest unit (exception filter) + supertest integration (/health). Pass.
- [x] T9: Web tests — Vitest + RTL (render + health query + counter click). Pass.
- [x] T10: ESLint strict (`no-explicit-any: error`) + Prettier in all workspaces; `pnpm -r lint` green.
- [x] T11: `scripts/verify.sh` wired to build shared → prisma generate → lint → typecheck → test, both apps; exits 0.
- [ ] T12 (optional, deferred): GitHub Actions CI running `verify.sh` — out of scope for this chore.

## Verification evidence
- V1 (implementer): verify.sh green per task.
- V2 (independent review): reviewer ran verify.sh itself + audited vs spec/ARCHITECTURE → APPROVE (after F1 PWA icons, F2 counter-test click, F3 web typecheck fixed). No P0.
- V3 (close): verify.sh run 3× back-to-back by the closer — all exit 0, identical counts (backend 5 tests/3 suites, web 3 tests). Not flaky.
