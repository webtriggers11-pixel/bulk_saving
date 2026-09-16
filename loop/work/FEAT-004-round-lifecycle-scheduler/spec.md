# FEAT-004 — Round lifecycle state machine + scheduled closing

**Status:** specced (autonomous) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-17

## Problem / Why

FEAT-003 rounds are OPEN|CLOSED with only a manual admin close. The product needs
rounds to **close automatically at their deadline** and to move through a real
lifecycle so the super-admin can act on the pooled demand (assign a vendor, mark
delivered) and residents can later rate. This feature implements the full state
machine (ARCHITECTURE.md) + the BullMQ deadline scheduler. It is backend-only;
the later transitions' UIs land with FEAT-005 (admin dashboard) and FEAT-007 (rating).

## Decisions baked in (ADR-0011)

- **Status set:** `OPEN → CLOSED_MET | CLOSED_EXPIRED → ASSIGNED → DELIVERED → RATED`,
  plus `CANCELLED` (from any pre-DELIVERED state). Replaces the interim OPEN|CLOSED.
- **"Met" rule:** at deadline, `CLOSED_MET` iff `unitsCount >= lowest tier threshold`
  (the minimum viable group), else `CLOSED_EXPIRED`.
- **Scheduler:** a BullMQ **delayed job per round**, fired at the deadline, runs a
  `RoundCloserProcessor` that performs the OPEN→CLOSED_* transition atomically (row lock).
- **All transitions go through `RoundsService`** via a single guarded `transition()` —
  invalid transitions throw `INVALID_ROUND_TRANSITION`. No status mutated elsewhere.
- ASSIGNED/DELIVERED/RATED transition *methods + guards* are implemented here; their
  admin/resident endpoints + vendor/rating data are wired in FEAT-005 / FEAT-007.

## Acceptance criteria (testable)

**State machine**
- [ ] `RoundStatus` enum extended to OPEN, CLOSED_MET, CLOSED_EXPIRED, ASSIGNED, DELIVERED, RATED, CANCELLED; migration applies (dev data mapped/reset acceptably).
- [ ] A single `transition(roundId, to, ...)` in `RoundsService` enforces a legal-transition map; illegal → `INVALID_ROUND_TRANSITION`. Unit tests cover the full legal/illegal matrix.
- [ ] `CANCELLED` reachable by admin from OPEN/CLOSED_MET/CLOSED_EXPIRED/ASSIGNED (not from DELIVERED/RATED).

**Scheduled auto-close**
- [ ] Creating a round (FEAT-003 admin create) enqueues a BullMQ delayed job at `deadline`.
- [ ] `RoundCloserProcessor` transitions an OPEN round at its deadline to CLOSED_MET (unitsCount >= lowest threshold) or CLOSED_EXPIRED, atomically under the round row lock; idempotent (safe if the round was already closed/cancelled — no-op).
- [ ] Manual admin close still works and routes through the same close logic (CLOSED_MET/EXPIRED by units). Changing/cancelling a round removes/supersedes its scheduled job.
- [ ] Integration test: a round with a near-immediate deadline is auto-closed by the processor to the correct terminal state (met vs expired), verified without waiting real minutes (enqueue with tiny delay / invoke the processor).

**Join interaction**
- [ ] Join/update/leave reject on any non-OPEN status with `ROUND_CLOSED` (already enforced via the row-lock status re-check; add tests for CLOSED_MET/EXPIRED/CANCELLED).

**General**
- [ ] `GET /rounds` (resident) still lists only OPEN rounds. DTO/envelope/TS-strict/no-any; DB via services; all round writes under the row lock.
- [ ] `bash scripts/verify.sh` passes (unit transition matrix + scheduler integration + join-rejection tests).

## Out of scope (later features)

- Vendor assignment + final price capture, mark-delivered/paid UI → FEAT-005 (admin dashboard).
- Resident rating (DELIVERED→RATED data + UI) → FEAT-007.
- Resident-facing view of their closed/assigned rounds ("my rounds" history) → with FEAT-005/007.
- Websocket push on auto-close (v1 residents poll).

## Open questions
- None blocking (decisions baked in). Revisit ADR-0011 if "met" should key off a configurable target rather than the lowest tier.
