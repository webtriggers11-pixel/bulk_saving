# WhatsApp sign-in — setup runbook

How to take "Sign in with WhatsApp" (FEAT-027, ADR-0038) from the local simulator to real WhatsApp,
first on Meta's free test number (today, ~30 minutes), then in production. Config reference is in
`DEPLOY.md` §2a; the design and its residual risks are in `loop/decisions/0038-whatsapp-tap-to-verify.md`.

## 0. What it costs

| Step | Cost |
|---|---|
| Resident's message to the business number | ₹0 — a user-initiated message |
| Our two replies (number buttons, "you're signed in") | ₹0 — service replies inside the 24-hour window the resident opened |
| Meta Cloud API | ₹0 platform fee (direct from Meta) |
| A reseller (Gupshup, AiSensy, Interakt…) instead of Meta direct | their monthly plan — not needed for this |
| SMS OTP fallback (residents without WhatsApp on that number) | per-SMS provider cost + DLT, as before |

Pricing reference: https://developers.facebook.com/docs/whatsapp/pricing — only *template* messages
are billed; this flow sends none.

## 1. Try it with real WhatsApp today (Meta test number + tunnel)

Prerequisites: a Facebook account, the API running locally (`pnpm --filter backend dev`, :3000),
a dev web server (`pnpm --filter web dev`), your phone with WhatsApp (+91 84199 97952).

1. **Create a Meta app** — https://developers.facebook.com/apps/ → *Create app* → use case *Other*
   → type *Business* → name it (e.g. "Bulk Saving Dev"). Add the **WhatsApp** product.
   Guide: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
2. **Collect the five values** from *WhatsApp → API Setup*:
   - `WHATSAPP_PHONE_NUMBER_ID` — "Phone number ID" under the test number
   - `WHATSAPP_ACCESS_TOKEN` — the *Temporary access token* (valid 24 h; fine for a trial)
   - `WHATSAPP_BUSINESS_NUMBER` — the test number shown as "From", digits only with country code
     (e.g. `15551234567`)
   - `WHATSAPP_APP_SECRET` — *App settings → Basic → App secret* (click *Show*)
   - `WHATSAPP_VERIFY_TOKEN` — any random string you invent, e.g. `openssl rand -hex 16`
3. **Add your phone as a recipient** — same *API Setup* page, "To" → *Manage phone number list* →
   add +91 84199 97952 and enter the code WhatsApp sends you. (Test numbers can message up to 5
   verified recipients.)
4. **Put the values in `apps/backend/.env`** (all five, or the API refuses to boot — that is on
   purpose; a partial set would half-work):
   ```
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_ACCESS_TOKEN=...
   WHATSAPP_APP_SECRET=...
   WHATSAPP_VERIFY_TOKEN=...
   WHATSAPP_BUSINESS_NUMBER=15551234567
   ```
   Restart the API. `curl -s localhost:3000/auth/methods` → `{"whatsapp":true}`. The dev simulator
   panel disappears from the web step: you are now in **cloud** mode.
5. **Expose the API over HTTPS** (Meta must reach the webhook):
   - Cloudflare quick tunnel (no account): `brew install cloudflared` then
     `cloudflared tunnel --url http://localhost:3000` — copy the `https://….trycloudflare.com` URL.
     Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
   - or ngrok: `ngrok http 3000` — https://ngrok.com/docs/getting-started/
6. **Register the webhook** — *WhatsApp → Configuration → Webhook → Edit*:
   - Callback URL: `https://<tunnel-host>/webhooks/whatsapp`
   - Verify token: the `WHATSAPP_VERIFY_TOKEN` you set
   - *Verify and save* — the API answers Meta's `hub.challenge` itself. Then under *Webhook fields*
     subscribe to **messages**.
   Guide: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks
7. **Sign in from your phone** — open the dev web server on the phone (same Wi-Fi, e.g.
   `http://<laptop-ip>:5173/onboard`; add that origin to `CORS_ORIGINS` or leave it unset to allow any
   localhost — for a LAN IP you need `CORS_ORIGINS=http://<laptop-ip>:5173`), invite code `BLUE0002` →
   *Continue with WhatsApp* → *Open WhatsApp* → *Send* → tap the number you see on screen → back in
   the browser you are signed in. From a laptop, scan the QR with the phone instead.

Expected API log lines: `[WaWebhookController]` deliveries, no `WARN`. In Meta's dashboard,
*Webhooks → Recent deliveries* shows 200s.

## 2. Make it production

1. **Business verification** — Meta Business Suite → *Settings → Security Centre → Start verification*
   with company documents. Days to weeks (BRIEF risk R1).
   https://www.facebook.com/business/help/2058515294227817
2. **A real phone number** for the WhatsApp Business account, with an approved **display name**
   ("Bulk Saving"). The number must not be registered on the consumer WhatsApp app.
   https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers
3. **A permanent token** — create a *System User* in Business Settings, assign the app, generate a
   token with `whatsapp_business_messaging` and `whatsapp_business_management`. Replace the 24-hour
   token with it.
   https://developers.facebook.com/docs/whatsapp/business-management-api/get-started
4. **Deploy the API on a public HTTPS host** (Caddy/nginx in front, `TRUST_PROXY=1` — DEPLOY.md), set
   the five variables in `.env.prod`, point the webhook at `https://api.<your-domain>/webhooks/whatsapp`.
5. **Pin the Graph version** — `WHATSAPP_GRAPH_VERSION` defaults to `v26.0`; versions live ~2 years.
   Changelog: https://developers.facebook.com/docs/graph-api/changelog
6. **Switch the app to Live mode** (App Dashboard, top toggle) once verification is through, or
   messages stay limited to the verified recipient list.

## 3. If something does not work

| Symptom | Cause → fix |
|---|---|
| API refuses to boot: "WhatsApp sign-in needs all of …" | one of the five variables missing/blank → set all five, or remove all five |
| *Verify and save* fails in the Meta dashboard | tunnel down, wrong URL path (`/webhooks/whatsapp`), or verify token differs → `curl "https://<tunnel>/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123"` must print `123` |
| Deliveries show 401 in *Recent deliveries* | `WHATSAPP_APP_SECRET` is from a different app / stale → copy it again; the API checks `X-Hub-Signature-256` over the raw body |
| Message sent, browser stays on "Waiting for your message…" | webhook not subscribed to **messages**; or the phone is not a verified recipient (test mode); or the tunnel URL changed (quick tunnels change on every restart — re-register) |
| No reply arrives in WhatsApp, API logs `Cloud API send failed: Invalid OAuth access token (code 190)` | the 24-hour token expired → new temporary token, or the permanent System User token |
| Reply arrives but tapping does nothing | the tap came from a different number than the one that sent the message (by design), or the request expired (3 minutes) → *Start again* |
| "This sign-in expired" immediately | laptop clock vs server clock skew, or the browser was away > 3 minutes → *Start again* |
| Button shows but `wa.me` opens a dead chat (`910000000000`) | the API is in **stub** mode (no `WHATSAPP_*`) and the web is a production build without the simulator → use a dev web server for the simulator, or set the five variables |
| 429 on `/auth/wa/status` behind a shared Wi-Fi NAT | ADR-0020's global 120/min per address; several residents polling at once → raise the ceiling in `app.module.ts` or relax it per route (noted in ADR-0038) |
| Resident has WhatsApp on another number / none | expected → *Use an SMS code instead* |

## 4. Where things live

- Routes: `POST /auth/wa/start`, `POST /auth/admin/wa/start`, `GET /auth/wa/status/:requestId`,
  `GET /auth/methods`, `GET|POST /webhooks/whatsapp` — `apps/backend/src/modules/auth/wa-*.ts`
- Cloud API client and stub: `apps/backend/src/modules/whatsapp/`
- Dev simulator (stub mode only): `POST /dev/whatsapp/inbound`, `POST /dev/whatsapp/tap`,
  `GET /dev/whatsapp/prompt` — `apps/backend/src/modules/dev/dev-whatsapp.controller.ts`
- Web step: `apps/web/src/features/auth/WhatsAppSignIn.tsx`, `useWhatsAppLogin.ts`
- Message shapes we send/parse: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages
  and https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
