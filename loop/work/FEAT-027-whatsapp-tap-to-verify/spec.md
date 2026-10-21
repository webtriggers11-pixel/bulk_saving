# FEAT-027 — Sign in with WhatsApp ("Tap to verify": the user messages us, we never pay to message them)

**Status:** done (V3 2026-10-20) · **Priority:** P1 · **Owner:** owner (pasted design: "Tap to verify reverses who sends the message … create new branch and do this and check") / agent · **Opened:** 2026-10-20 · **Branch:** `feat/FEAT-027-whatsapp-tap-to-verify`

## Problem / Why
SMS OTP costs ₹0.15–0.20 per login plus DLT setup, and nobody has typed six digits happily. A WhatsApp
message the USER starts is free (user-initiated conversation), and WhatsApp already verified their
number — so a message arriving from a number proves possession of it. Three taps, nothing to type.
SMS OTP stays as the fallback (not everyone's WhatsApp is on the number they expect).

## User stories
1. As a resident, I enter my invite code, tap "Continue with WhatsApp", tap Send in WhatsApp, tap the
   number I see on screen, come back — and I am signed in with the same lifetime session as today.
2. As an admin, I do the same from /admin/login, with the role decided only at token time (ADR-0023).
3. As a laptop user, I scan a QR code with my phone instead of tapping a link.
4. As a developer with no Meta account, I can exercise the whole flow locally (simulator) and prove the
   webhook path against a signed payload in the test suite.

## Acceptance criteria (testable)
- [x] AC1 **Start.** `POST /auth/wa/start { inviteCode }` (resident) and `POST /auth/admin/wa/start {}`
      (admin) create a login request in Redis (3-min TTL): a secret `requestId` (browser only), a
      semi-public `code` `BS-XXXXXX` (goes in the message), a 2-digit `matchNumber`, the device
      description from the User-Agent. Response: `{ requestId, code, waLink, matchNumber, expiresAt }`.
      Unknown invite code → 400 `INVALID_INVITE_CODE`. Rate-limited per client (10/hour) → 429.
      When WhatsApp login is not configured → 404 `WHATSAPP_LOGIN_DISABLED`; `GET /auth/methods`
      says `{ whatsapp: false }` so the UI never shows the button.
- [x] AC2 **Webhook in.** `GET /webhooks/whatsapp` answers Meta's subscribe handshake (verify token →
      plain-text challenge, else 403). `POST /webhooks/whatsapp` refuses any body whose
      `X-Hub-Signature-256` is not the HMAC-SHA256 of the RAW bytes under `WHATSAPP_APP_SECRET` (401),
      answers 200 for everything else, and de-duplicates Meta's redeliveries by message id.
- [x] AC3 **Attach + prompt.** A text message containing a live code attaches the sender's number to
      that request (`awaiting_confirm`) and replies with ONE interactive message: "Signing in to Bulk
      Saving on <device>. Which number is on your screen? Only tap if that's you, right now." with three
      number buttons, one of them the matchNumber, in random order. A code that is unknown, expired or
      already attached gets no reply that reveals anything (nothing at all). The reply is IDENTICAL for
      admin and non-admin numbers (ADR-0023). A phone may attach to at most 5 requests per hour.
- [x] AC4 **Confirm / deny.** Tapping the matching button (from the same number that attached) marks
      the request `confirmed`; any other button marks it `denied` and replies "That wasn't the number
      on the screen — if you didn't start this sign-in, nothing happened." A denied or confirmed
      request cannot change state again.
- [x] AC5 **Status + tokens.** `GET /auth/wa/status/:requestId` → `{ status }` for
      `pending | awaiting_confirm | denied | expired`; on `confirmed` it issues the SAME tokens as the
      OTP doors (ADR-0024/0034 sessions), consumes the request atomically (a second call → `expired`),
      and returns `{ status: 'confirmed', accessToken, refreshToken, resident }`. Resident door:
      `upsertVerified` in the society bound from the invite code at START time, the WhatsApp profile
      name as the default name of a NEW resident only. Admin door: `findAdminByPhone` at this moment;
      not an admin → `{ status: 'denied', reason: 'NOT_AN_ADMIN' }` (reachable only by the browser that
      started it, after the phone's owner tapped the right number — the OTP door's 403 equivalent).
      Unknown requestId → `expired` (no oracle between "never existed" and "gone").
- [x] AC6 **Web — both doors.** When `/auth/methods` says WhatsApp is on: "Continue with WhatsApp"
      leads, "Use an SMS code instead" stays one tap away (the existing flow, unchanged). The WhatsApp
      step shows the match number large, the steps, and a live status line driven by polling every 2s:
      waiting for the message → "Message received — now tap **47** in WhatsApp" → signed in (navigates);
      denied / expired → a plain message and "Start again". On a phone the primary button opens the
      `wa.me` link; on a laptop a QR code of the same link is shown (plus the link, for WhatsApp Web).
      Leaving the step stops the polling. Offline: the existing honest states.
- [x] AC7 **Dev simulator (DEV only, same gates as FEAT-026/ADR-0037).** Under `DevToolsModule`:
      `POST /dev/whatsapp/inbound { from, text }`, `POST /dev/whatsapp/tap { from, buttonId }`,
      `GET /dev/whatsapp/prompt?phone=` (what the stub sender last "sent" to that phone). In a DEV
      bundle only, the WhatsApp step shows a "DEV ONLY · Simulate WhatsApp" panel: pick a phone,
      "Send the message as this number", the business's reply appears with its three buttons, tap one.
      The production bundle carries none of it (`check-dev-only.mjs` extended: `dev/whatsapp`).
- [x] AC8 **Config.** `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
      `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_BUSINESS_NUMBER` (+ optional `WHATSAPP_GRAPH_VERSION`): all
      five or none (boot refuses a partial set). All five → Cloud API mode. None + dev echo on
      (`OTP_DEV_LOG=true`, `NODE_ENV=development|test`) → stub mode (login works through the simulator).
      Otherwise off. The Graph API client posts interactive-button and text messages; errors are
      logged redacted (never the token). `.env.example` + DEPLOY.md document it, including the
      30-minute "Meta test number + tunnel" path to try it with real WhatsApp before business verification.
- [x] AC9 **Tests.** Backend: unit (code format/alphabet, code extraction, device description,
      signature check, mode resolution, env all-or-none); integration (full flow on both doors with a
      capturing sender and SIGNED webhook payloads, dedupe, wrong button, unknown code, bad signature,
      expiry, consume-once, start rate limit, methods on/off, handshake). Web: WhatsApp step
      (polling states, denied/expired, phone vs laptop, QR), both pages (button shown only when
      enabled, SMS fallback), dev panel opt-in. Gate; V2; V3.
- [x] AC10 ADR-0038 records the mechanism, the lure attack and the number-match defence with its
      honest residual (3 buttons = 1 in 3 per lured message, bounded by the per-phone attach budget).

## Out of scope
Round updates over WhatsApp (ADR-0013's revisit; the sender module is reusable for it). Meta business
verification itself (BRIEF R1, the owner's). A typed-number (1-in-90) match: revisit trigger in the ADR.

## Open questions
- Buttons (1 tap, 1-in-3) vs typing the number (1-in-90)? → Buttons, per the owner's design; the
  per-phone attach budget bounds repeated lures; ADR-0038 revisit trigger. (agent, 2026-10-20)
- New dependency `qrcode` (web, MIT, no deps) for the laptop QR → added under the autonomous-loop
  authorisation; lazy-loaded only on non-phone screens. (agent, 2026-10-20)
