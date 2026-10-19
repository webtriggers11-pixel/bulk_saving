# FEAT-020 — Web push notifications on the outbox + worker pipeline

**Status:** specced · **Priority:** P1 · **Owner:** Vivek (requested) / agent · **Opened:** 2026-10-19

## Problem / Why

Owner: "create push notification as per application with custom message as per theme but
use workers queue and all scalable flow for this — very important feat". Today every
round event (joined, closing soon, closed met/expired, assigned, delivered, cancelled)
reaches a resident only as a (stub) SMS. Residents who installed the PWA should get a rich
push on their phone — the right words for the event, in the colour they chose — delivered
by workers that scale with the number of devices, retry safely and never double-send.

## User stories

1. As a resident, I can turn on notifications for this phone (from Profile, or when I join
   a round) and turn them off again.
2. As a resident, when something happens to a round I'm in, my phone shows a notification
   written for that event, styled in my colour, that opens the right screen when tapped.
3. As the operator, a burst (a round closing with 200 participants on 3 devices each) is
   sent by workers in parallel, retried with backoff, rate-limited, never sent twice, and
   dead devices are pruned automatically.

## Acceptance criteria

- [ ] AC1 — `PushSubscription` table (resident, society, endpoint unique, keys, accent,
      failure count, last success); `POST /push/subscriptions`, `DELETE /push/subscriptions`,
      `GET /push/vapid-public-key`; society and resident from the JWT only (ADR-0003).
- [ ] AC2 — the transactional outbox (ADR-0013) is unchanged in shape: when a Notification is
      dispatched, the worker fans out one `push-send` job per subscription of that resident
      (jobId `<notificationId>:<subscriptionId>` → idempotent), alongside the SMS.
- [ ] AC3 — `push-send` worker: exponential backoff, a queue rate limiter, configurable
      concurrency; 404/410 from the push service deletes the subscription; other failures
      count toward pruning after N consecutive failures; never logs keys or endpoints in full.
- [ ] AC4 — per-event templates → `{ title, body, url, tag, accent, actions? }`; the tag
      collapses repeats per round; the accent is the device's chosen accent (stored at
      subscribe time, updated when the person changes colour).
- [ ] AC5 — service worker shows the notification (icon + badge, accent-tinted image per
      accent), focuses/opens the `url` on click; works for an installed PWA (iOS 16.4+, Android,
      desktop).
- [ ] AC6 — opt-in UI: Profile → Notifications (on/off, with the browser's permission state),
      plus a one-time contextual prompt after a first join; permission is only ever requested
      from a tap.
- [ ] AC7 — production: VAPID keys from env, asserted by `assertProductionSafe`; push disabled
      cleanly (no crash) when keys are absent in dev.
- [ ] AC8 — tests: fan-out idempotency, pruning on 410, template per event, DTO validation,
      tenancy, SW handlers (unit), opt-in flow; gate green; V2; V3.

## Needs the owner's attention (flagged per CLAUDE.md, proceeding under the autonomous mandate)

- New dependency: `web-push` (backend) — the standard VAPID/encryption library.
- New Prisma migration: `PushSubscription` table (additive, no data change).
- New env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Out of scope

- Native app push (FCM/APNs SDKs), marketing/broadcast campaigns, quiet hours (follow-ups).
