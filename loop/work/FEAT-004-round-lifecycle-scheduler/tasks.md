# Tasks FEAT-004 — Round lifecycle state machine + scheduler

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-004): ...`) AND append a LOG.md entry.

- [x] T1: Prisma `RoundStatus` → OPEN, CLOSED_MET, CLOSED_EXPIRED, ASSIGNED, DELIVERED, RATED, CANCELLED; migration clean (map/reset interim CLOSED). — depends: —
- [x] T2: `RoundsService.transition()` + legal-transition map; illegal → `INVALID_ROUND_TRANSITION`; all status writes route through it (under row lock). Unit tests: full legal/illegal matrix. — depends: T1
- [x] T3: Close logic → CLOSED_MET (unitsCount >= lowest threshold) else CLOSED_EXPIRED; refactor manual close to use it; add `POST /admin/rounds/:id/cancel` (SUPER_ADMIN) → CANCELLED (guarded). Integration tests (close-met, close-expired, cancel, 403 resident). — depends: T2
- [x] T4: BullMQ `round-closing` queue + `RoundCloserProcessor` (load+lock, no-op if non-OPEN, else close met/expired); enqueue delayed job on admin round-create (jobId = round id); remove/replace job on manual close/cancel. — depends: T3
- [x] T5: Scheduler integration tests — near-immediate-deadline round auto-closes to correct terminal state (met + expired), idempotent no-op when already closed/cancelled; join/update/leave on CLOSED_MET/EXPIRED/CANCELLED → `ROUND_CLOSED`. — depends: T4

## Close
- [x] T6: V2 independent review — transition-guard matrix, scheduler idempotency/atomicity, enum migration; reviewer runs verify.sh itself. — depends: T1–T5
- [x] T7: V3 fresh double-run of verify.sh; log both; close (REGISTRY → done, commit). — depends: T6

## P2 follow-ups (from V2, not blocking)
- Periodic reconciliation (not just at boot): a close job that exhausts all 6 retries during a DB outage longer than ~1 min leaves the round OPEN until the next boot.
- Tests share the dev DB/Redis (predates FEAT-004); consider a dedicated test DB + Redis db index.
- A deadline-edit path (none yet) must call cancel() then schedule(): schedule() does not move a pending job.
