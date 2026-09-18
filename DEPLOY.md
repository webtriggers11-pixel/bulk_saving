# DEPLOY — from an empty server to a live society

Written in CHORE-007 (ADR-0020). Everything below has been exercised locally except the
steps marked **UNVERIFIED**, which need a platform and credentials this repo does not have.

---

## 0. What still blocks a real pilot

**The app cannot send an SMS.** The bound notification channel is `StubSmsChannel`, which
logs and discards. A resident therefore cannot receive a login OTP in production, which
makes the product unusable rather than merely unhardened. Choosing a provider costs money,
so it is the owner's decision (BRIEF R1; ADR-0007's revisit trigger).

When a provider is picked:

1. Implement `NotificationChannel` for it (the interface is `sendOtp` + `send`).
2. Change the `useClass` binding in `apps/backend/src/modules/notifications/notifications.module.ts`.
3. Note that Indian transactional SMS needs **DLT-registered templates with fixed variable
   slots** — the current free-form bodies in `notification-templates.ts` must be restructured
   to match registered templates before a real sender ID will carry them.
4. The stub is also where the dev OTP affordance lives, so swapping it removes that too.

Also worth deciding before real residents arrive: `Notification` has no `societyId`
(ADR-0013 amendment), and lifecycle SMS delivery is **at-least-once**, so a resident can
occasionally receive a duplicate.

---

## 1. Prerequisites

- Docker + Docker Compose on the host.
- Postgres 16 and Redis 7 — the compose file runs both; a managed Postgres is fine, in which
  case point `DATABASE_URL` at it and drop the `postgres` service.
- A DNS name and TLS for the API and the PWA. **UNVERIFIED**: no reverse proxy is included.
  Terminate TLS in front of both containers (Caddy, nginx, or the platform's own).

## 2. Configuration

```bash
cp .env.prod.example .env.prod
# generate each secret separately:
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 48   # OTP_HASH_SECRET
```

`CORS_ORIGINS` must list the exact browser origin(s) of the PWA. **The API refuses to boot
in production without it**, and also refuses to boot if `OTP_DEV_LOG=true` or if any secret
is still an example value from this repository (`assertProductionSafe`). Verified: the
container exits with the offending variable named.

`VITE_API_URL` is baked into the PWA at **build** time, so changing it means rebuilding the
web image.

## 3. Migrate, then start

Migrations are a **separate step**, not a container entrypoint: two API instances starting
together must not race each other through `migrate deploy`.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Verify:

```bash
curl -fsS http://localhost:3000/health          # {"success":true,...}
curl -sD - -o /dev/null http://localhost:3000/health | grep -i strict-transport
```

Both verified locally against the built image, along with: an unlisted `Origin` receives no
`Access-Control-Allow-Origin`, the listed one does, and the global rate limit returns 429
after ~120 requests/minute (116 × 200 then 19 × 429 when measured).

## 4. Seed the first society

The seed is the only way societies and the first super-admin exist (no self-serve signup).
It is idempotent.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api \
  node apps/backend/prisma/dist/seed.js
```

**Before running it in production, edit `apps/backend/prisma/seed.ts`**: it creates two demo
societies (`GREEN001`, `BLUE0002`), a super-admin on `+919999900001`, and a demo round. Those
are development fixtures — replace them with the real society and the real operator's phone,
or a stranger who guesses the invite code can join.

## 5. Operating notes

- **Health check**: `GET /health`. The compose file wires a container healthcheck to it.
- **Queues**: BullMQ jobs (round closing, the 24h reminder, notification sends) run **in the
  API process**. Scaling the API scales the workers too; jobs are idempotent and keyed, so
  duplicates are safe, but a round's close job is only reconciled **at boot** — a long Redis
  outage without a restart delays closes.
- **Shutdown**: `app.enableShutdownHooks()` is on, so SIGTERM closes Prisma, Redis and the
  BullMQ workers. Give containers a grace period rather than SIGKILL.
- **Logs**: Nest's default logger to stdout. **UNVERIFIED**: no aggregation or error
  monitoring is configured — that needs a service the owner has not chosen.
- **Backups**: **UNVERIFIED** — nothing in this repo backs up Postgres. The `pgdata-prod`
  volume is the only copy of every round, payment and rating.

## 6. CI

`.github/workflows/verify.yml` runs the real gate (`scripts/verify.sh`: lint → typecheck →
build → tests) against Postgres and Redis services, then builds both images. It does not
publish or deploy them — that needs a registry and a platform.

## 7. Rollback

Images are immutable, so redeploy the previous tag. **Migrations are not automatically
reversible**: every migration so far is additive, so an older API runs against a newer schema,
but that is a property of the current history rather than a guarantee. Check before relying
on it.
