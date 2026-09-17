# Tasks FEAT-006 — Notifications (SMS-first)

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-006): ...`) AND append a LOG.md entry.

- [ ] T1: Prisma schema — `Notification` model + `NotificationType` / `NotificationStatus` enums; migration generated with `migrate diff` and applied with `migrate deploy`; drift check clean.
- [ ] T2: `notification-templates.ts` — pure render function per type + dispatcher; unit tests for content, 320-char cap, and no-secrets rule. — depends: T1
- [ ] T3: `NotificationsService` — `stageForParticipant`, `stageForRoundParticipants` (tx-scoped, `skipDuplicates`), `markSent`, `markFailed`; unit/integration tests for staging + dedupe collision. — depends: T2
- [ ] T4: `notifications` queue + `NotificationDispatchProcessor` (PENDING-only guard, SENT/FAILED, last-attempt failure recording) + `NotificationsService.dispatch` (best-effort, never throws to caller). — depends: T3
- [ ] T5: Wire `RoundsService.join` → ROUND_JOINED, staged in-tx, dispatched post-commit; integration test asserts one row, SENT after processing, and nothing staged when the join throws. — depends: T4
- [ ] T6: Wire `closeRound` (MET/EXPIRED), `cancel`, `assign`, `deliver` fan-outs; integration tests per type incl. re-close staging nothing and a no-participant round staging nothing. — depends: T5
- [ ] T7: `RoundReminderScheduler` + `RoundReminderProcessor` — delayed job at `deadline − 24h`, skipped when already past, cancelled on close/cancel, fan-out at fire time, OPEN-only no-op; scheduler unit test for the computed delay. — depends: T4
- [ ] T8: Wire the reminder into round create/close/cancel; integration test with a real BullMQ delayed job (seconds-out deadline). — depends: T7
- [ ] T9: `NotificationDispatchReconciler` (boot, skipped under `NODE_ENV=test`, scoped method for tests) + test that a PENDING row with no job is re-dispatched. — depends: T4
- [ ] T10: Full-path integration sweep: every type stage → dispatch → SENT against real DB/Redis; assert redaction in logs and that a channel failure leaves FAILED with `lastError`, not a lost row. — depends: T6, T8, T9
- [ ] T11: V2 — independent code-reviewer subagent runs `verify.sh` itself and reviews the diff vs spec + ADR-0013. — depends: T10
- [ ] T12: V3 — fresh double run of `verify.sh` back-to-back, both logged; REGISTRY → done; LOG close entry. — depends: T11

## P2 follow-ups (triage as CHOREs, do not block close)

- (filled in during V2)
