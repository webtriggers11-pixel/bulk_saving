# FEAT-006 — Notifications (SMS-first: OTP + round lifecycle alerts)

**Status:** specced (autonomous) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-17

## Problem / Why

The round mechanic only works if residents hear about it. Today the only message the
platform sends is the login OTP (FEAT-001, stub adapter); a resident who joins a round
never learns that it filled, expired, got a vendor, or was delivered, and gets no nudge
before the deadline. Rounds close on a schedule (FEAT-004) and are assigned/delivered by
the admin (FEAT-005), so every event that matters already exists in the state machine —
nothing is wired to a message. Without this, the urgency the BRIEF's group-buy mechanic
depends on ("6 of 10 joined · closes in 4 days") never reaches anyone.

## Decisions baked in (ADR-0013)

- **Transactional outbox.** A `Notification` row is written in the SAME transaction as the
  round change that caused it, so a rolled-back round change can never send a message and a
  committed one always has its message recorded. Dispatch to BullMQ happens after commit;
  a boot reconciler picks up anything left PENDING (same safety pattern as FEAT-004's
  round-closing reconciler).
- **One job per recipient** (`jobId = notification id`), so one resident's failure retries
  without re-sending to everyone else.
- **Dedupe key is unique in the DB**, so a retried job, a double-fired scheduler, or a
  re-closed round can never double-send.
- **OTP stays synchronous and un-queued** (CLAUDE.md: non-OTP sends are queued). OTP bodies
  are never persisted — the outbox stores only lifecycle messages.
- **Stub SMS adapter stays.** Picking a real provider costs money and is an owner decision
  with its own ADR (BRIEF R1). WhatsApp remains a fast-follow behind the same
  `NotificationChannel` interface.
- Backend-only feature. No `apps/web` change.

## User stories

1. As a resident, I get an SMS confirming my pledge when I join a round, so I know it registered.
2. As a resident, I get a reminder before the deadline of a round I joined, so I can invite neighbours or change my pledge.
3. As a resident, I get an SMS when a round I joined closes — whether it hit the target (with the unlocked price) or expired.
4. As a resident, I get an SMS when a vendor is scheduled, with the vendor name and my amount due.
5. As a resident, I get an SMS when the job is marked delivered, so I know the round is complete.
6. As a resident, I get an SMS if a round I joined is cancelled, so I am not left waiting.
7. As the operator, a message is never sent twice for the same event, and a failed send is retried and visible as FAILED rather than lost.

## Acceptance criteria (testable — this IS the definition of done)

**Schema**
- [ ] Migration adds `Notification` (id, residentId FK cascade, roundId FK cascade nullable, type, status, body, dedupeKey unique, attempts, lastError?, sentAt?, createdAt, updatedAt) plus enums `NotificationType` (ROUND_JOINED, ROUND_CLOSING_SOON, ROUND_CLOSED_MET, ROUND_CLOSED_EXPIRED, ROUND_ASSIGNED, ROUND_DELIVERED, ROUND_CANCELLED) and `NotificationStatus` (PENDING, SENT, FAILED). Indexes on `(status, createdAt)` and `(residentId, createdAt)`. Applies cleanly to existing data (additive only).

**Templates (pure functions, unit-tested)**
- [ ] One render function per type producing an SMS body under 320 chars, containing the service name and the society-relevant facts: joined → units + current price; closing-soon → units so far, target gap and deadline; closed-met → unlocked price; closed-expired → no charge; assigned → vendor name + amount due (`finalPrice × units`); delivered → completion; cancelled → cancellation.
- [ ] Bodies never contain an OTP, a JWT, or any phone number.

**Outbox + dispatch**
- [ ] Joining a round stages exactly one ROUND_JOINED notification for the joining resident, inside the join transaction; a join that throws (closed round, lock failure) stages nothing.
- [ ] A round closing (deadline job or manual close) stages one ROUND_CLOSED_MET or ROUND_CLOSED_EXPIRED notification per participant, in the close transaction. Assign stages ROUND_ASSIGNED per participant; deliver stages ROUND_DELIVERED per participant; cancel stages ROUND_CANCELLED per participant. A round with no participants stages nothing.
- [ ] Re-closing an already-closed round (idempotent no-op) stages nothing new, and a second close attempt never produces a second row for the same (type, round, resident).
- [ ] Every staged row is dispatched to the `notifications` queue after the transaction commits; the processor calls `NotificationChannel.send(phone, body)` and flips the row to SENT with `sentAt`.
- [ ] A channel failure retries with backoff (attempts > 1); after the final attempt the row is FAILED with `lastError` set and `attempts` recorded, and is never silently dropped.
- [ ] A duplicate dispatch of the same dedupeKey results in exactly one SENT row and one channel call (unique-constraint collision handled, not crashed).
- [ ] On boot, a reconciler re-dispatches PENDING rows that have no queue job (skipped under `NODE_ENV=test`, like the round-closing reconciler).

**Closing-soon reminder**
- [ ] Opening a round schedules one delayed reminder job at `deadline − 24h`; if that instant is already past at creation time, no reminder is scheduled (the window is shorter than the reminder lead).
- [ ] The reminder fans out at fire time to the round's participants AT THAT MOMENT (not at schedule time), and only while the round is still OPEN — a closed or cancelled round's reminder is a no-op.
- [ ] Closing or cancelling a round removes its pending reminder job. Scheduling is idempotent (`jobId` derived from the round id).
- [ ] The reminder is covered by an integration test using a real BullMQ delayed job.

**Non-functional / safety**
- [ ] Logs identify recipients only by redacted phone (`redactPhone`) and never include the OTP; the lifecycle body may be logged.
- [ ] A notification failure never fails or rolls back the round operation that caused it (dispatch is after commit and best-effort; the row remains PENDING for the reconciler).
- [ ] `bash scripts/verify.sh` exits 0, with integration tests covering each type end-to-end (stage → dispatch → SENT) against the real DB/Redis.

## Out of scope (explicit, prevents gold-plating)

- Any real SMS/WhatsApp provider integration, credentials, or cost (owner decision, own ADR).
- Web push, in-app notification centre, an admin notifications UI, and any `apps/web` change.
- Per-resident notification preferences / opt-out, quiet hours, and i18n (English only).
- Digest batching, marketing sends to non-participants, and "a new round opened in your society" broadcasts.
- Rating-request messages (FEAT-007 owns those).

## Open questions (agent must ask, never assume)

- Real SMS provider choice (MSG91 / Twilio / Gupshup) and spend → NOT asked now; deliberately deferred, the stub stays. Owner decision, costs money.
- Reminder lead time fixed at 24h → judgment call, recorded in ADR-0013 with a revisit trigger; configurable via env if ops disagree.
