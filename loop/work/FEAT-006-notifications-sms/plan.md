# Plan FEAT-006 — Notifications (SMS-first)

**Derived from:** spec.md · **Approved by:** Vivek (standing autonomous authorization) on 2026-09-17

## Implemented as (amendment, 2026-09-18 — V2 P2-1)

The design below is what was approved; three things changed during the build and
this section is the correction, so a later reader does not trust a stale plan:

1. **Module split.** §3's `stageForParticipant` / `stageForRoundParticipants` did
   NOT stay on `NotificationsService`. The real split is: `NotificationsService`
   = generic outbox (`stage` / `dispatch` / `markSent` / `recordAttemptFailure` /
   `findForSend` / `listPending` / `hasPendingJob`), and `RoundNotificationsService`
   (rounds module) = all round knowledge (`stageJoined`, `stageForParticipants`).
   `RoundsModule` imports `NotificationsModule`, so the round query + pricing +
   vendor loading the plan put in the outbox would have been a circular domain
   dependency.
2. **Reminder scheduler ownership.** §4 had `RoundsService` taking
   `RoundReminderScheduler`; it went to `RoundsAdminService` instead (that is
   where round creation, close and cancel live). Consequence: only the admin
   close/cancel paths remove a pending reminder — the deadline-driven close does
   not (harmless: the reminder has already fired by then, and a stale job no-ops
   on the OPEN check).
3. **Module exports.** §8's `NotificationsModule` does NOT export the reminder
   scheduler; it exports `NOTIFICATION_CHANNEL`, `NotificationsService` and
   `NotificationDispatchReconciler`. `RoundsModule` exports the reminder scheduler.
4. **`stage()` returns ids to dispatch**, which includes rows that were already
   staged and are still PENDING — not only newly created ones (§3 said "actually
   created"). Safe because dispatch is idempotent on `jobId`.
5. **Job id separator:** `reminder-<roundId>`, not `reminder:<roundId>` — BullMQ
   rejects a custom job id containing `:`.

## Technical approach

Backend only. A transactional outbox (ADR-0013) bolted onto the existing state machine, using
infrastructure already in the repo — no new dependency.

1. **Schema.** Add `Notification` + `NotificationType` + `NotificationStatus` to
   `apps/backend/prisma/schema.prisma`. Additive migration only. Because the dev DB's
   `_prisma_migrations` still holds the rolled-back FEAT-004 row (HANDOFF "needs the owner"),
   generate the SQL with `prisma migrate diff` and apply with `prisma migrate deploy` — never
   `migrate dev`, which would demand a dev-DB reset.
2. **Templates.** `notifications/notification-templates.ts`: one pure `render<Type>(input)` per
   type returning a string, plus a `renderNotification(type, input)` dispatcher. No I/O, no Nest —
   unit-testable in isolation, and the natural place to enforce the 320-char and no-secrets rules.
3. **Outbox service.** `notifications/notifications.service.ts`:
   - `stageForParticipant(tx, {type, round, participant, resident})` → one row (join confirmation).
   - `stageForRoundParticipants(tx, type, roundId)` → loads participants inside the tx, renders a
     body per resident, `createMany({ skipDuplicates: true })` on the unique `dedupeKey`, returns
     the ids actually created.
   - `dispatch(ids)` → adds one BullMQ job per id (`jobId = notification id`), swallowing errors
     (logged) so a Redis problem never fails the caller.
   - `markSent(id)` / `markFailed(id, err, attempts)` used by the processor.
4. **Wiring into rounds.** `RoundsService` gains `NotificationsService` (and
   `RoundReminderScheduler`) as constructor deps. Each mutating method stages inside its existing
   `inRoundTx`, collects the staged ids, and dispatches after the transaction resolves — the
   transaction callback returns `{ result, staged }` internally so nothing is dispatched for a
   rolled-back transaction. Touch points: `join` (ROUND_JOINED), `closeRound` (MET/EXPIRED),
   `cancel` (CANCELLED), `assign` (ASSIGNED), `deliver` (DELIVERED). `updatePledge` and `leave`
   stay silent (spec: no message for those).
5. **Queue + processor.** `NOTIFICATIONS_QUEUE = 'notifications'` registered in
   `NotificationsModule`; `NotificationDispatchProcessor` loads the row, skips it unless PENDING,
   sends via the injected `NotificationChannel`, and marks SENT / FAILED (FAILED only on the last
   attempt, so backoff retries get their chances).
6. **Reminder.** `RoundReminderScheduler` (delayed job, `jobId = reminder:<roundId>`, scheduled on
   round create when `deadline − 24h > now`, cancelled on close/cancel) +
   `RoundReminderProcessor`, which re-reads the round, no-ops unless OPEN, then stages + dispatches
   ROUND_CLOSING_SOON for the participants that exist at fire time. Mirrors
   `RoundClosingScheduler` / `RoundCloserProcessor` deliberately, including the not-found retry.
7. **Reconciler.** `NotificationDispatchReconciler` (`OnApplicationBootstrap`, skipped when
   `NODE_ENV=test`) re-dispatches PENDING rows with no queue job. Same shape as
   `RoundClosingReconciler`, and exposes a scoped method the tests call directly.
8. **Module boundaries.** `NotificationsModule` exports `NotificationsService`,
   `NOTIFICATION_CHANNEL` and the reminder scheduler; `RoundsModule` imports it. The rounds domain
   never touches the queue or the channel directly, and status still only moves through
   `RoundsService.transition()` (no notification code writes round state).

## Data model / contracts

```prisma
enum NotificationType   { ROUND_JOINED ROUND_CLOSING_SOON ROUND_CLOSED_MET ROUND_CLOSED_EXPIRED ROUND_ASSIGNED ROUND_DELIVERED ROUND_CANCELLED }
enum NotificationStatus { PENDING SENT FAILED }

model Notification {
  id         String @id @default(cuid())
  residentId String            // FK Resident, onDelete: Cascade
  roundId    String?           // FK Round,    onDelete: Cascade
  type       NotificationType
  status     NotificationStatus @default(PENDING)
  body       String
  dedupeKey  String @unique
  attempts   Int    @default(0)
  lastError  String?
  sentAt     DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([status, createdAt])
  @@index([residentId, createdAt])
}
```

- **No HTTP surface.** No controller, no DTO, no `@bulk/shared` change, no `apps/web` change.
- **Queues:** `notifications` (per-recipient send, 5 attempts, exponential backoff from 1s) and
  `round-reminder` (one delayed job per round). The existing `round-closing` queue is untouched.
- **Env:** none new. The stub channel is still bound in `NotificationsModule`.

## New decisions required

- **ADR-0013** — transactional outbox, per-recipient jobs, unique dedupe key. Confidence High;
  research depth quick check. Written and accepted before implementation.
- Real provider choice: deliberately NOT decided (costs money → owner). Recorded in the spec's open
  questions; the stub adapter stays.

## Risks

- **Extra writes inside the round row lock.** Staging runs inside the locked transaction, adding
  inserts to a critical section that BUG-001 already showed can queue. Mitigation: one `createMany`,
  no external calls inside the transaction, and the 30s timeout from BUG-001 stands. If contention
  shows up, ADR-0013's revisit trigger covers moving to a staged-ids-only insert.
- **Test pollution.** Tests share the dev DB/Redis (known FEAT-004 P2). Notification rows are new
  global rows; every assertion must be scoped by the round/resident the test created, and the
  reconciler stays disabled under `NODE_ENV=test`.
- **Reminder timing in tests.** A real 24h delay cannot be tested directly; the integration test
  schedules with an injected near-future deadline (seconds) to exercise the real delayed job, and
  the 24h lead itself is asserted at the scheduler level (computed delay), not by waiting.
- **Migration on the dev DB** with its known stale checksum row — `migrate diff` + `migrate deploy`
  only, then a drift check. Supersedes nothing; ADR-0013 does not touch ADR-0004/0011 semantics.
- **Double-send** is the feature's core failure mode. Mitigated by the DB-unique dedupeKey plus a
  PENDING-only guard in the processor; explicitly asserted by tests (re-close, duplicate dispatch).
