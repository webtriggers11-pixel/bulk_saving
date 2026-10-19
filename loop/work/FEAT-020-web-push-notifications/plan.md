# FEAT-020 — plan (ADR-0032 at start)

Backend (NestJS, BullMQ, Prisma):
1. Migration: `PushSubscription` (+ index on residentId; unique endpoint).
2. `PushModule`: controller (subscribe/unsubscribe/vapid key, DTOs), service (upsert by
   endpoint, tenancy from JWT), `WebPushSender` wrapping `web-push` behind an interface
   (stubbed in tests and when VAPID is absent).
3. Fan-out: `NotificationDispatchProcessor` → after the SMS, `PushFanout.enqueue(notification)`
   adds one `push-send` job per subscription (jobId idempotent, attempts 5, exp backoff).
4. `PushSendProcessor`: limiter (e.g. 200/s), concurrency from env; 404/410 → delete;
   else failureCount++ and prune at threshold; success → reset + lastSuccessAt.
5. Templates: `push-templates.ts` per NotificationType → title/body/url/tag.
6. Env + `assertProductionSafe` for VAPID.

Frontend (PWA):
7. `public/push-sw.js` imported into the generated SW (`workbox.importScripts`): `push`
   → showNotification (icon/badge/accent image, tag, data.url); `notificationclick` → focus
   or open.
8. `lib/push.ts`: support check, permission state, subscribe (VAPID key) / unsubscribe, sync
   accent on colour change. Profile → Notifications row (Switch); contextual prompt after
   first join.
9. Accent notification images (one small PNG per accent) in `public/push/`.

Verification: unit tests both sides; local end-to-end with real VAPID keys in Chrome
(desktop push works on localhost); V2; V3.
