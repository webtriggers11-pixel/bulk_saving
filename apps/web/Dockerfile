# syntax=docker/dockerfile:1
# Production image for the React PWA (CHORE-007). The build is fully static, so the
# runtime is just nginx serving `dist` with SPA fallback.
#
# VITE_API_URL is baked in at BUILD time (Vite inlines import.meta.env), so it is a
# build argument, not a runtime environment variable. Rebuild to point at a different API.
#
# Build from the REPO ROOT:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t bulk-saving-web .

FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
# Same fetch resilience as the API image.
ENV npm_config_fetch_timeout=900000 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=180000 \
    npm_config_network_concurrency=4
# tsconfig.base.json too: every workspace tsconfig extends it, so the builds fail
# without it (TS5083) even though nothing imports it directly.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @bulk/shared build && pnpm --filter web build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
