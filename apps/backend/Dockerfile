# syntax=docker/dockerfile:1
# Production image for the NestJS API (CHORE-007, ADR-0020).
#
# Multi-stage so the runtime image carries no build toolchain and no dev
# dependencies. pnpm workspace-aware: the backend depends on @bulk/shared, so the
# build stage needs the whole workspace, while the runtime stage takes only the
# built output plus production node_modules.
#
# Build from the REPO ROOT:  docker build -f apps/backend/Dockerfile -t bulk-saving-api .

# node:24 — matches local dev (Node 24.6) and what pnpm 11.10 requires. node:20
# fails outright: pnpm 11 uses builtins Node 20 does not have
# (ERR_UNKNOWN_BUILTIN_MODULE), which is why STACK.md's "Node 20 LTS" was corrected.
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && apk add --no-cache libc6-compat openssl
WORKDIR /repo

# ---------- dependencies (cached on lockfile changes only) ----------
FROM base AS deps
# Generous fetch timeouts and retries: a registry fetch that is merely SLOW should not
# fail a deploy. (Observed at ~10 KiB/s on a constrained network, where pnpm's default
# 60s timeout aborts mid-install.)
ENV npm_config_fetch_timeout=900000 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=180000 \
    npm_config_network_concurrency=4
# tsconfig.base.json too: every workspace tsconfig extends it, so the builds fail
# without it (TS5083) even though nothing imports it directly.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/backend apps/backend
# Prisma client must be generated against the schema before the Nest build.
RUN pnpm --filter @bulk/shared build \
 && pnpm --filter backend exec prisma generate \
 && pnpm --filter backend build \
 && pnpm --filter backend exec tsc -p prisma/tsconfig.seed.json

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production

# node_modules is copied wholesale from the build stage, dev dependencies included.
#
# Two tidier options were tried and rejected on evidence:
#  - a second `pnpm install --prod`: needs the registry again, and a build that reaches
#    the network twice fails twice as often (it did, on a slow link);
#  - `pnpm prune --prod`: removes the WORKSPACE node_modules symlinks along with the dev
#    deps, so the image built fine and then crashed on `Cannot find module
#    'reflect-metadata'`.
# So the image carries dev dependencies it does not run. That is a size and
# attack-surface cost, recorded as a CHORE-007 follow-up rather than hidden: the fix is
# `pnpm --filter backend deploy --prod`, which needs verifying on a fast connection.
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/pnpm-lock.yaml ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/backend/package.json apps/backend/
COPY --from=build /repo/apps/backend/node_modules apps/backend/node_modules
COPY --from=build /repo/apps/backend/dist apps/backend/dist
COPY --from=build /repo/apps/backend/prisma apps/backend/prisma

# Never run as root.
USER node
EXPOSE 3000

# The container does NOT run migrations on boot: that is an explicit deploy step
# (see DEPLOY.md), because two instances starting at once must not race each other
# through `migrate deploy`.
CMD ["node", "apps/backend/dist/main.js"]
