#!/usr/bin/env bash
# THE single verification entrypoint. Hooks, agents, and humans all call this.
# Stack: pnpm workspace — NestJS backend + React/Vite web + shared TS types.
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

echo "==> [verify] test (all workspaces)"
pnpm -r test

echo "==> [verify] OK — lint + tests passed for every workspace"
