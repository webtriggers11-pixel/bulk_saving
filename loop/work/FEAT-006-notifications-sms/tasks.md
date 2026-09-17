# Tasks FEAT-006 — Notifications (SMS-first)

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-006): ...`) AND append a LOG.md entry.

- [x] T1: Prisma schema — `Notification` model + `NotificationType` / `NotificationStatus` enums; migration generated with `migrate diff` and applied with `migrate deploy`; drift check clean.
- [x] T2: `notification-templates.ts` — pure render function per type + dispatcher; unit tests for content, 320-char cap, and no-secrets rule. — depends: T1
- [x] T3: `NotificationsService` — `stageForParticipant`, `stageForRoundParticipants` (tx-scoped, `skipDuplicates`), `markSent`, `markFailed`; unit/integration tests for staging + dedupe collision. — depends: T2
- [x] T4: `notifications` queue + `NotificationDispatchProcessor` (PENDING-only guard, SENT/FAILED, last-attempt failure recording) + `NotificationsService.dispatch` (best-effort, never throws to caller). — depends: T3
- [x] T5: Wire `RoundsService.join` → ROUND_JOINED, staged in-tx, dispatched post-commit; integration test asserts one row, SENT after processing, and nothing staged when the join throws. — depends: T4
- [x] T6: Wire `closeRound` (MET/EXPIRED), `cancel`, `assign`, `deliver` fan-outs; integration tests per type incl. re-close staging nothing and a no-participant round staging nothing. — depends: T5
- [x] T7: `RoundReminderScheduler` + `RoundReminderProcessor` — delayed job at `deadline − 24h`, skipped when already past, cancelled on close/cancel, fan-out at fire time, OPEN-only no-op; scheduler unit test for the computed delay. — depends: T4
- [x] T8: Wire the reminder into round create/close/cancel; integration test with a real BullMQ delayed job (seconds-out deadline). — depends: T7
- [x] T9: `NotificationDispatchReconciler` (boot, skipped under `NODE_ENV=test`, scoped method for tests) + test that a PENDING row with no job is re-dispatched. — depends: T4
- [x] T10: Full-path integration sweep: every type stage → dispatch → SENT against real DB/Redis; assert redaction in logs and that a channel failure leaves FAILED with `lastError`, not a lost row. — depends: T6, T8, T9
- [x] T11: V2 — independent code-reviewer subagent runs `verify.sh` itself and reviews the diff vs spec + ADR-0013. — depends: T10
- [ ] T12: V3 — fresh double run of `verify.sh` back-to-back, both logged; REGISTRY → done; LOG close entry. — depends: T11

## Notes from the build

- The plan put `stageForRoundParticipants` in `NotificationsService`. Implemented
  instead as a split: `NotificationsService` is a generic outbox (residents,
  bodies, dedupe keys, queue) and `RoundNotificationsService` (rounds module)
  owns all round knowledge — loading, pricing, vendor, rendering. Keeps round
  concepts out of the outbox and avoids a notifications → rounds import.
- BullMQ rejects a custom job id containing `:`, so the reminder job id is
  `reminder-<roundId>`, not `reminder:<roundId>`. Caught by V1 (it made admin
  round creation 500 — the scheduler throws inside the create transaction).
- Backend Jest runs suites in parallel against one shared Redis, so any app's
  send worker can consume a job the instant it is queued. Delivery assertions
  therefore stage rows directly and drive the processor by hand; only the
  reminder test relies on a real delayed job.

## V2 outcome (2026-09-18)

Two independent reviewers, both CHANGES REQUESTED, **no P0**. One ran verify.sh
itself (exit 0 on a settled tree: backend 251, web 50); the other reviewed spec /
ADR / plan conformance and message content without touching the DB.

Fixed before close:

- **P1 (both reviewers): nothing proved that a round operation dispatches.** Deleting
  the dispatch call left the suite green — every delivery test drove the processor by
  hand. Added a test that spies on `dispatch` around a real `join` and asserts the
  staged row id (a spy, not a queue read: parallel suites share Redis).
- **P1: CLOSED_MET quoted a total the next SMS contradicts.** It rendered the TIER
  price × units as if owed, while the binding amount is the admin's negotiated
  `finalPrice`. Now explicitly indicative, with "we'll confirm the final amount".
- **P1: three messages promised follow-ups that do not exist** ("text you the
  schedule", "confirm the visit time", "when the next one opens", "open a fresh round
  soon", "we'll ask how it went"). Removed, and a test now forbids the phrases.
- **P2: "closing soon" could be sent AFTER "cancelled"** — the reminder read the
  status without the row lock. It now takes `FOR UPDATE` like every other round path.
- **P2: over-subscribed rounds rendered "12 of 5 units pledged"**, and the message
  asked to "unlock a better price" when no better tier existed. Progress and the
  invite line are now branched on the real tier state, and the unmet case says what
  happens if the target is missed.
- **P2: the boot reconciler had no staleness cutoff** — after a long outage it would
  text "the round closes 16 Sep" days later. Rows older than 24h are skipped and
  counted; hitting the 500-row scan cap now warns.
- **P2: round creation ran two sets of Redis round-trips on Prisma's default 5s
  budget.** It now uses `ROUND_TX_OPTIONS`.
- **P2: no test proved staged rows roll back** (the "stages nothing" tests were all
  rejected before staging ran). Added one that stages for real, then throws.
- **P2: T10 claimed log redaction that nothing asserted.** Added a logger-spy test.
- **P2: cancel's reminder removal was untested.** Added.
- **P2: plan.md and ADR-0013 had drifted** from the code (method names, module
  ownership, the `reminder-` job id). Both amended, and ADR-0013 now states honestly
  that delivery is **at-least-once** — the dedupe key makes staging exactly-once, but
  a send that succeeds before its `markSent` write can be retried.
- **P2: documentation debt.** ARCHITECTURE.md gained the outbox section, both queues,
  decision A10, a changelog entry, and a correction to the stale `NotificationChannel`
  signature.

## P2 follow-ups (triage as CHOREs, do not block close)

- `dispatch()` is a sequential per-recipient loop; `queue.addBulk` makes a
  200-participant fan-out one round-trip instead of 200.
- `clamp()` truncates from the END, so a pathological service or vendor name could cut
  the rupee amount off a money message. Truncate the variable part instead.
- No message offers a reply / help / contact route, and ROUND_DELIVERED does not
  restate the amount owed after ROUND_ASSIGNED said "payable on completion".
- "units" is internal jargon in a resident-facing SMS (a resident thinks "2 ACs").
- The deadline-driven closer does not cancel a pending reminder (harmless — it has
  already fired by then); only the admin close/cancel paths do.
- A join confirmation staged just before an immediate leave still goes out. Arguably
  correct; recorded as known behaviour.
- **Owner decision:** `Notification` has no `societyId` (ADR-0013 amendment).
- **Owner decision:** real SMS provider. Indian DLT registration will require fixed
  template slots, which these free-form bodies must be restructured into.
