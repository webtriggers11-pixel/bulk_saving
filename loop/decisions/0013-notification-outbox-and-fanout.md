# ADR-0013: Transactional notification outbox, per-recipient BullMQ jobs, dedupe key

**Status:** Accepted
**Date:** 2026-09-17 · **Deciders:** Vivek (autonomous authorization), agent · **Work item:** FEAT-006

## Confidence

**Level:** High
**Basis:** The transactional outbox is a well-established pattern for "change state and tell
someone" (Kleppmann / microservices literature), and this codebase already learned the same
lesson the hard way in FEAT-004: enqueueing outside the round transaction left an OPEN round with
no close job, and the fix was to make create+enqueue atomic plus a boot reconciler. Applying the
same shape here is consistent rather than novel. The parts that are judgment calls (24h reminder
lead, which events get a message) are called out below.

## Research depth

**Depth:** Quick check — existing FEAT-004 scheduler/reconciler code and ADR-0011 were re-read;
the pattern itself is standard. No external research needed. No new dependency: `@nestjs/bullmq`,
BullMQ, Prisma and the `NotificationChannel` interface are all already in the stack.

## Context and problem

Round state changes (join, close-met, close-expired, assign, deliver, cancel) must reach residents
by SMS. The state changes happen inside row-locked Prisma transactions (ADR-0004, ADR-0011) and
some are driven by BullMQ jobs that retry (FEAT-004). We must decide where a pending message lives,
how it is dispatched, and how a retry or a double-fired job is prevented from sending twice — all
while the real SMS provider is still a stub and a send must never break a round operation.

## Options considered

1. **Fire-and-forget: call the channel (or enqueue) directly from the service after the call.**
   Pro: least code. Con: a rolled-back transaction can still send ("your round closed" for a close
   that never happened); a crash between commit and send loses the message with no record; retries
   double-send; nothing is auditable when a resident says "I got nothing".
2. **Transactional outbox: write `Notification` rows in the same transaction as the state change;
   dispatch to BullMQ after commit; reconcile PENDING rows at boot** (chosen). Pro: atomic with the
   cause, so no phantom sends and no lost sends; every message has a durable row with status,
   attempts and error; retries are safe; matches the FEAT-004 pattern already in the codebase.
   Con: one extra table and an extra write inside the round lock; PENDING rows need a reconciler.
3. **Nest event emitter / domain events, listeners send.** Pro: decoupled services. Con: needs a new
   dependency (owner approval), in-process events are lost on crash, and it still needs an outbox to
   be safe — decoupling without durability solves the wrong half of the problem.
4. **One queue job per round event, fanning out to all participants inside the job.** Pro: fewer
   jobs. Con: one resident's provider failure retries the whole fan-out, re-sending to everyone who
   already got it — exactly the duplicate this feature must not produce.

## Decision

Option 2, with per-recipient jobs (rejecting option 4's fan-out-inside-the-job).

- `Notification` rows are staged by `NotificationsService.stage*(tx, ...)` using the caller's Prisma
  transaction client, so they commit or roll back with the round change. Body text is rendered at
  stage time by pure template functions, from data already loaded in the transaction.
- `dedupeKey` is unique in the DB: `<TYPE>:<roundId>:<residentId>` for lifecycle fan-outs, and
  `ROUND_JOINED:<participantId>` for join confirmations (the participant row is deleted on leave, so
  a rejoin legitimately gets a new key and a new confirmation). A collision is swallowed as
  "already staged", which is what makes idempotent re-closes and retried jobs safe.
- After the transaction commits, the caller dispatches the staged ids: one BullMQ job per
  notification, `jobId = notification id`, with retries and exponential backoff. Dispatch is
  best-effort — a Redis outage leaves rows PENDING and never fails the round operation.
- A boot `NotificationDispatchReconciler` re-dispatches PENDING rows that have no job (skipped when
  `NODE_ENV=test`, like `RoundClosingReconciler`).
- The processor is the ONLY code that calls `NotificationChannel.send` for lifecycle messages; it
  marks the row SENT, or FAILED with `lastError` after the final attempt.
- The "closing soon" reminder is its own delayed job per round at `deadline − 24h`
  (`jobId = reminder:<roundId>`), which fans out at FIRE time to the participants that exist then
  and no-ops unless the round is still OPEN. Removed when the round closes or is cancelled.
- OTP delivery is unchanged: synchronous, direct, never persisted (an OTP in an outbox row would be
  a stored credential).

## Consequences

Good: no phantom or lost lifecycle messages; safe retries; a durable, queryable record of what was
sent to whom and why it failed; the real provider swaps in behind `NotificationChannel` with no
caller change; WhatsApp can be added as a second channel per row later.
Bad: an extra table and a few extra inserts inside the round row lock (small, `createMany`, measured
against the BUG-001 30s transaction budget); PENDING rows are only reconciled at boot, so a Redis
outage plus no restart delays messages indefinitely; `body` is rendered at stage time, so a template
fix does not retroactively change a queued message.

## Revisit trigger

- A real provider lands (ADR for provider + cost) → revisit per-channel routing, rate limits and
  provider-side dedupe.
- Boot-only reconciliation proves insufficient (messages delayed by a Redis outage without a
  restart) → add a periodic sweep (shared trigger with the FEAT-004 follow-up).
- Ops or residents report the 24h reminder lead is wrong, or ask for more than one reminder → make
  the lead configurable per society/service.
- Volume grows to where per-recipient jobs are costly, or residents ask for opt-out/quiet hours.
