# Plan FEAT-027 — Sign in with WhatsApp

**Derived from:** spec.md · **Approved by:** autonomous (owner's standing instruction) on 2026-10-20

## Technical approach
Additions to the auth module; the token side does not change (ADR-0007/0024/0034).

**Backend**
- `modules/whatsapp/`: `WhatsAppSender` interface + `WHATSAPP_SENDER` token; `CloudApiWhatsAppSender`
  (Node `fetch` → `https://graph.facebook.com/<v>/<phoneNumberId>/messages`, Bearer token, 8s timeout,
  errors redacted); `StubWhatsAppSender` (dev: logs + stashes the last prompt per phone in Redis for the
  simulator). `whatsapp.config.ts`: `whatsappLoginMode(env)` → `'cloud' | 'stub' | 'off'`.
- `modules/auth/wa-login.service.ts`: Redis state machine. Keys `wa:req:<requestId>` (hash: door,
  societyId, code, match, options, device, status, phone, profileName, createdAt; TTL 180s, re-armed to
  120s on confirm/deny), `wa:code:<code>` → requestId (same TTL), `wa:msg:<metaMessageId>` NX 10 min,
  `wa:start:<client>` hourly counter, `wa:attach:<phone>` hourly counter. Lua for attach (CAS pending →
  awaiting_confirm), decide (awaiting_confirm → confirmed/denied, same phone), consume (confirmed → gone).
- `wa-login.controller.ts`: `POST /auth/wa/start`, `POST /auth/admin/wa/start`,
  `GET /auth/wa/status/:requestId`, `GET /auth/methods`.
- `wa-webhook.controller.ts`: `GET/POST /webhooks/whatsapp`; raw body via Nest `rawBody: true`
  (`APP_OPTIONS` exported from bootstrap, used by main.ts and the test helper).
- `dev/dev-whatsapp.controller.ts` under `DevToolsModule` (imports AuthModule for the service).
- `env.validation.ts`: the five vars, all-or-none; production refuses stub (already: no dev echo).
- `ResidentsService.upsertVerifiedDefaultName` — name only on create.

**Web**
- `features/auth/wa.api.ts` (`fetchAuthMethods`, `startWhatsAppLogin`, `startAdminWhatsAppLogin`,
  `fetchWhatsAppStatus`), `useWhatsAppLogin.ts` (start mutation + status polling with
  `refetchInterval` until terminal), `WhatsAppSignIn.tsx` (the step: number, steps, status, QR on
  laptops via lazy `qrcode`, SMS fallback), `useAuthMethods.ts`. Both pages gain a method choice.
- DEV: `useDevWhatsApp.ts` + `dev-whatsapp.api.ts` (dynamic import behind the folded constant),
  `DevWhatsAppPanel.tsx`. `scripts/check-dev-only.mjs` adds `dev/whatsapp`.

## Data model / contracts
No Prisma change. Shared: `AuthMethods`, `WaStartBody`, `WaStartResponse`, `WaStatusResponse`
(discriminated on `status`), `WA_LOGIN_CODE_PATTERN`, `whatsAppLoginMessage(code)`.
Error codes: `WHATSAPP_LOGIN_DISABLED`, `WHATSAPP_WEBHOOK_SIGNATURE`.

## New decisions required
ADR-0038 (Medium / quick check of Meta Cloud API message + webhook shapes).

## Risks
- Meta payload shapes drift → parser is tolerant and unit-tested against a recorded sample.
- The webhook needs a public HTTPS URL; a laptop needs a tunnel — documented, not solved here.
- `rawBody: true` changes app creation; the test helper must use the same options or the signature
  check cannot be exercised (it is).
