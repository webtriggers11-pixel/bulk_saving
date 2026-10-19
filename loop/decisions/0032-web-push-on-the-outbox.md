# ADR-0032: Web push rides the notification outbox, one BullMQ job per device

**Status:** Accepted · **Date:** 2026-10-19 · **Deciders:** Vivek ("push notification … custom
message as per theme … use workers queue and all scalable flow"), agent · **Work item:** FEAT-020
· **Builds on:** ADR-0013 (outbox), ADR-0015 (PWA), ADR-0003 (tenancy), ADR-0031 (accents)

## Confidence

**Level:** High (pipeline, idempotency, pruning — integration-tested on real Postgres + Redis) ·
Medium (delivery on real phones: iOS only delivers to a Home-Screen app, 16.4+)

## Research depth

**Quick check** — Web Push + VAPID (RFC 8030/8292) via the `web-push` library (the de-facto
Node implementation); push-service status codes 404/410 = subscription gone; BullMQ custom
job ids must not contain `:` (found by the integration test, not the docs).

## Decisions

1. **Push is a second channel on the existing outbox, not a new pipeline.** The dispatch
   worker (ADR-0013) fans a dispatched Notification out to one `push-send` job per device of
   that resident, then sends the SMS. Push therefore inherits the outbox guarantees: staged in
   the same transaction as the round change, never sent for a rolled-back event, reconciled
   at boot. Fan-out runs FIRST so an SMS provider outage cannot hold push back.
2. **One job per (notification, device), id `<notificationId>_<subscriptionId>`.** Idempotent
   under retries (the dispatch job retrying after an SMS failure queues nothing new); each device
   retries independently with exponential backoff (5 attempts); a slow push service for one
   device never delays another.
3. **Scale knobs:** `PUSH_CONCURRENCY` (parallel sends per worker process) and
   `PUSH_RATE_PER_SECOND` (a BullMQ limiter shared by every worker on the Redis) — scale out by
   running more API/worker processes; the limiter keeps the total under push-service limits.
4. **Device hygiene:** 404/410 → the subscription is deleted at once (no retry); any other
   failure counts only on a job's final attempt, and three failed jobs in a row prune the device.
5. **SSRF allowlist.** The server POSTs to the subscribed endpoint, so an endpoint is accepted
   only if it is https on a known push service (FCM, Mozilla, Apple, WNS). Otherwise subscribing
   would make our workers call any URL a client chose (e.g. cloud metadata).
6. **Tenancy:** resident and society come from the JWT (ADR-0003); unknown body fields are
   stripped by the global pipe; unsubscribe deletes only the caller's own device.
7. **"As per theme":** each device stores its accent (FEAT-019) at subscribe time and again when
   the person changes colour; the push carries it and the service worker shows that accent's
   icon (one PNG per accent, `/push/icon-<accent>.png`). Titles are written per event; the body
   is the outbox's already-rendered message (no OTP/token/phone — ADR-0013).
8. **Service worker:** `public/push-sw.js` imported via `workbox.importScripts` — caching
   (ADR-0015) unchanged. Taps open only same-app paths (an off-site URL falls back to `/`).
9. **Opt-in UX:** permission is requested only from a tap — the Profile switch, or the one-time
   prompt on the rounds screen after a first join ("Not now" remembered per device).
10. **Config:** VAPID keys from env; absent in dev → push switched off cleanly
    (`PUSH_DISABLED`); absent in production → the API refuses to boot (`assertProductionSafe`).

11. **Once per notification is a claim on the row** (`Notification.pushQueuedAt`, set where
    null) — job ids dedupe only while completed jobs are still in Redis, and a dispatch retried
    in an SMS outage or re-run by the reconciler would otherwise push again (V2 P1). Fan-out
    faults are logged and never block the SMS (V2 P2).
    The guarantee is therefore **at most once per notification**: the claim is released if
    reading devices or queueing fails, but a process crash between the claim and the queue
    write drops that one push (the SMS still goes). Chosen over at-least-once because a
    duplicate re-alerts the person (`renotify`), and a lost push is covered by SMS.
    A forced sign-out (refresh token expired) also drops push on that device; the resident
    turns it on again after signing back in (V2 r2).
12. **Endpoints are stored normalised** (WHATWG `href`) and re-checked against the allowlist at
    send time, so the URL validated is the URL called, whatever another parser would make of
    the raw string (V2 P3).
13. **Signing out releases the phone** (browser unsubscribe + server delete while the token
    works; browser-only on a forced sign-out) so a shared phone never shows the previous
    resident's rounds; a subscription under a rotated server key is replaced, not re-posted.
14. Accepted risk: anyone holding a device's endpoint URL could re-register it under their own
    account and keys — the device then gets pushes it cannot decrypt (denial of service only;
    endpoints are unguessable capability URLs). This is what lets a shared phone switch residents.

## Consequences

- New dependency `web-push`; additive migration (`PushSubscription`); three new env vars.
- Rotating VAPID keys invalidates every subscription — documented in `.env.prod.example`.

## Revisit triggers

- Native apps (FCM/APNs SDKs) → a third channel on the same fan-out.
- Broadcasts (one message to a whole society) → a fan-out job that pages through devices
  instead of per-notification rows.
- Quiet hours / per-event preferences requested → a preferences table consulted at fan-out.
