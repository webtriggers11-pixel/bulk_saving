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

**Sign in with WhatsApp (FEAT-027, ADR-0038) is the ₹0-per-login alternative**, and it needs
no SMS provider — but it needs a Meta app. See §2a.

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

`JWT_REFRESH_TTL_SECONDS` is unset or `0` by default, and that means **sessions never
expire** (ADR-0024): one OTP per device, forever. Set a positive number of seconds to
restore an expiring session.

Every sign-in is its own session (ADR-0034): `refresh:<residentId>:<sid>` per device, indexed
in `sessions:<residentId>`. A resident's own sign-out ends their one session. Because there is
no clock, **ending every session of a resident is a manual act**:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec redis sh -c \
  'redis-cli --scan --pattern "refresh:<residentId>:*" | xargs -r redis-cli DEL; redis-cli DEL "sessions:<residentId>" "refresh:<residentId>"'
```

That ends every device, and takes effect within one `JWT_ACCESS_TTL_SECONDS` (900s by
default) — which is why that value stays small. There is no sign-out-everywhere screen yet;
for a lost or shared **admin** device this command is the whole recovery procedure.

`TRUST_PROXY` **must be set when the API sits behind a reverse proxy** (Caddy, nginx, a
platform load balancer): the number of proxies in front of it (`1` for one), or their
addresses (`loopback, 10.0.0.0/8`). The OTP budgets are per client (ADR-0027) and so is
the global throttler; without it, every caller looks like the proxy and shares one budget.
`true` is refused at boot — it would let any client name its own address.

`VITE_API_URL` is baked into the PWA at **build** time, so changing it means rebuilding the
web image.

## 2a. Sign in with WhatsApp ("Tap to verify")

The resident sends *us* a pre-filled WhatsApp message; we reply with a number-match prompt;
the browser collects the usual tokens. User-initiated conversations are free, so this costs
₹0 per login (ADR-0038). It is **off** until all five variables are set — a partial set
refuses to boot:

```
WHATSAPP_PHONE_NUMBER_ID   numeric id of the business number (Meta app → WhatsApp → API Setup)
WHATSAPP_ACCESS_TOKEN      a System User token with whatsapp_business_messaging
WHATSAPP_APP_SECRET        the app's App Secret — every webhook delivery is checked against it
WHATSAPP_VERIFY_TOKEN      any random string; the same one goes in the webhook's "Verify token"
WHATSAPP_BUSINESS_NUMBER   digits with the country code, no + (what wa.me/<number> opens)
WHATSAPP_GRAPH_VERSION     optional, default v26.0
```

Then, in the Meta app's WhatsApp → Configuration: webhook callback URL
`https://<api-host>/webhooks/whatsapp`, the verify token above, and subscribe to the
**messages** field. The API answers the handshake itself (`GET` echoes `hub.challenge`), and
refuses any `POST` whose `X-Hub-Signature-256` does not match the raw body under the App
Secret. The webhook must be reachable from the internet over HTTPS — a Wi-Fi-only laptop
cannot receive it without a tunnel.

**Try it with real WhatsApp before business verification (about 30 minutes):** a Meta app in
development mode comes with a free **test phone number** that can message up to five
verified recipient numbers and receives webhooks like a real one. Use its phone-number id,
the temporary access token (24 h — fine for a trial, never for production), the app secret,
and the test number itself as `WHATSAPP_BUSINESS_NUMBER`. Expose the local API with a tunnel
(`cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`) and register
`https://<tunnel-host>/webhooks/whatsapp`. Add your own phone as a recipient in the Meta
dashboard, open the PWA on it, and go through the three taps. Business verification, a
display name and a production System User token are what turn this into the real thing
(BRIEF R1).

**Without a Meta app**, the whole flow still runs locally in stub mode (`OTP_DEV_LOG=true`,
`NODE_ENV=development`, none of the five set): the DEV build shows a "Simulate WhatsApp"
panel on the sign-in step that plays the phone's side against the same code the webhook
calls. The production bundle carries none of that (gate step), and production can never be
in stub mode (the dev echo is refused there).

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

## 8. The product website (`apps/site`, FEAT-028)

A static site, separate from the API and the PWA. `pnpm --filter site build` writes
`apps/site/dist/` — plain HTML, CSS, and two JS chunks (the page, and the lazy Three.js
scene). Serve that folder from any static host (nginx, a CDN, GitHub Pages); nothing runs
server-side. Set the real domain in `apps/site/astro.config.mjs` (`site`) before the first
deploy: it feeds the canonical and Open Graph URLs. The site reads the same localStorage
keys as the app (`bulk:scheme`, `bulk:palette`), so hosting it on the app's origin gives a
signed-in resident their own colour; on another origin it simply defaults to Mono.
