# Tasks FEAT-004 — Round lifecycle state machine + scheduler

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-004): ...`) AND append a LOG.md entry.

- [ ] T1: Prisma `RoundStatus` → OPEN, CLOSED_MET, CLOSED_EXPIRED, ASSIGNED, DELIVERED, RATED, CANCELLED; migration clean (map/reset interim CLOSED). — depends: —
- [ ] T2: `RoundsService.transition()` + legal-transition map; illegal → `INVALID_ROUND_TRANSITION`; all status writes route through it (under row lock). Unit tests: full legal/illegal matrix. — depends: T1
- [ ] T3: Close logic → CLOSED_MET (unitsCount >= lowest threshold) else CLOSED_EXPIRED; refactor manual close to use it; add `POST /admin/rounds/:id/cancel` (SUPER_ADMIN) → CANCELLED (guarded). Integration tests (close-met, close-expired, cancel, 403 resident). — depends: T2
- [ ] T4: BullMQ `round-closing` queue + `RoundCloserProcessor` (load+lock, no-op if non-OPEN, else close met/expired); enqueue delayed job on admin round-create (jobId = round id); remove/replace job on manual close/cancel. — depends: T3
- [ ] T5: Scheduler integration tests — near-immediate-deadline round auto-closes to correct terminal state (met + expired), idempotent no-op when already closed/cancelled; join/update/leave on CLOSED_MET/EXPIRED/CANCELLED → `ROUND_CLOSED`. — depends: T4

## Close
- [ ] T6: V2 independent review — transition-guard matrix, scheduler idempotency/atomicity, enum migration; reviewer runs verify.sh itself. — depends: T1–T5
- [ ] T7: V3 fresh double-run of verify.sh; log both; close (REGISTRY → done, commit). — depends: T6
