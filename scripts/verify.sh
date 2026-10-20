#!/usr/bin/env bash
# THE single verification entrypoint. Hooks, agents, and humans all call this.
# Stack: pnpm workspace — NestJS backend + React/Vite web + shared TS types.
# Gates, in order: shared types -> prisma client -> lint -> typecheck -> BUILD -> tests.
# Infra-dependent tests (BullMQ/Redis) require `docker compose up -d` first.
# Exit 0 = verified. Any other exit = feedback for the loop.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [verify] building shared types (@bulk/shared)"
pnpm --filter @bulk/shared build

echo "==> [verify] generating Prisma client (backend)"
pnpm --filter backend exec prisma generate

echo "==> [verify] lint (all workspaces)"
pnpm -r lint

echo "==> [verify] typecheck (all workspaces)"
pnpm -r typecheck

echo "==> [verify] build (all workspaces)"
# CHORE-004: lint + typecheck do NOT catch a broken build. `tsc --noEmit` resolves
# types without running Vite's bundler, so a missing runtime dependency behind a
# virtual module (FEAT-008: `virtual:pwa-register/react` needing `workbox-window`)
# left this gate green while `apps/web` could not be built at all. This does NOT
# weaken framework invariant 3 — the suites below still run; the build is an extra
# gate, not a substitute for a test.
pnpm -r build

# FEAT-011: the build is the only place that knows whether a class name resolves to
# a rule. Two classes shipped in this repo that emitted no CSS at all while every
# unit test passed (a Tailwind namespace collision, then off-scale alpha steps);
# jsdom applies no CSS, so only the built stylesheet can answer.
echo "==> [verify] css classes (every class in apps/web must resolve to a rule)"
node scripts/check-css-classes.mjs

# FEAT-026 (ADR-0037): dev-only code (the OTP toast's fetch) must not reach the production bundle.
node scripts/check-dev-only.mjs

echo "==> [verify] test (all workspaces, one at a time)"
# BUG-002: sequential so backend Jest (real DB/Redis) and web Vitest don't
# starve each other for CPU and trip timeouts.
pnpm -r --workspace-concurrency=1 test

echo "==> [verify] OK — lint, typecheck, build and tests passed for every workspace"
