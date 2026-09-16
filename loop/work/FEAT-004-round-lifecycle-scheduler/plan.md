# Plan FEAT-004 — Round lifecycle state machine + scheduler

**Derived from:** spec.md · **Approved by:** autonomous (owner directive) — 2026-09-17

## Technical approach

Extend `RoundStatus`, add a guarded `transition()` + legal-transition map in `RoundsService`
(the state-machine owner), and add a BullMQ `round-closing` queue with a delayed job per round
fired at its deadline. The `RoundCloserProcessor` runs the OPEN→CLOSED_* transition atomically
under the ADR-0004 row lock, idempotently. Backend-only.

## Data model / contracts

- Prisma enum `RoundStatus` → OPEN, CLOSED_MET, CLOSED_EXPIRED, ASSIGNED, DELIVERED, RATED, CANCELLED. Migration (dev: map interim CLOSED→CLOSED_EXPIRED or reset).
- No new tables. Round already has deadline + unitsCount + tiers.
- Legal transitions:
  OPEN→{CLOSED_MET, CLOSED_EXPIRED, CANCELLED};
  CLOSED_MET→{ASSIGNED, CANCELLED}; CLOSED_EXPIRED→{CANCELLED};
  ASSIGNED→{DELIVERED, CANCELLED}; DELIVERED→{RATED}; RATED,CANCELLED→terminal.
- Error code: `INVALID_ROUND_TRANSITION`.

## Endpoints (this feature)
- Reuse FEAT-003 admin close → now maps to CLOSED_MET/EXPIRED via the close logic.
- `POST /admin/rounds/:id/cancel` (SUPER_ADMIN) → CANCELLED (guarded).
- ASSIGNED/DELIVERED/RATED transition METHODS exist + are unit-tested, but their endpoints/
  data (vendor, price, rating) are wired in FEAT-005/FEAT-007 (out of scope here).

## Scheduler
- `round-closing` BullMQ queue (reuse Redis/BullMQ wiring). On admin create (FEAT-003), enqueue a
  delayed job `{ roundId }` with delay = deadline − now (jobId = round id, so re-create/change replaces it).
- `RoundCloserProcessor`: load+lock round; if status !== OPEN → no-op (idempotent); else compute
  met (unitsCount >= lowest threshold) → transition to CLOSED_MET/CLOSED_EXPIRED in the tx.
- On manual close/cancel, remove the delayed job (best-effort) so it doesn't double-fire (idempotency covers races anyway).

## New decisions required
- **ADR-0011** — written, Accepted. ADR-0004 (row lock) + ADR-0010 apply.

## Risks
- **Enum migration** on existing dev rows (seed demo round is OPEN → fine; any CLOSED test rows: map to CLOSED_EXPIRED or reset the dev DB). Ensure migrate is clean + tests green.
- **Testing time-based closing without waiting:** enqueue with a tiny delay in tests, or invoke the processor handler directly with a past-deadline round; assert the resulting status. Keep deterministic.
- **Idempotency / double-fire:** processor must no-op on non-OPEN; unit + integration test the no-op.
- **Transition-guard completeness:** unit-test the full legal/illegal matrix so future features can't make illegal jumps.

## Task outline (tasks.md)
T1 enum + migration · T2 transition map + guarded transition() + unit matrix · T3 close logic (met/expired) refactor + cancel endpoint · T4 BullMQ round-closing queue + processor + enqueue-on-create + job replace/remove · T5 scheduler integration test (met + expired + idempotent no-op) + join-rejection tests. Close: T6 V2 · T7 V3.
