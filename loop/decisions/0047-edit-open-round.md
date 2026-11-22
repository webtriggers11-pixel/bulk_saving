# ADR-0047: Editing an open round: deadline and tiers only, under the round lock, deadline-aware close job

**Status:** Accepted · **Date:** 2026-11-23 · **Deciders:** owner ("not able to edit it … update that"), agent · **Work item:** FEAT-038 · **Builds on:** ADR-0004 (row lock, Postgres authoritative), ADR-0010 (tiers), ADR-0011 (deadline close job), ADR-0013 (reminders, dedupe)

## Decisions
1. **What's editable:** deadline and tiers, and only while the round is **OPEN**. After it closes, the tiers decide whether it met its target and the price residents pay, so changing them would rewrite an outcome. Society and service are fixed, because pledges and asks belong to that pair. To change those, cancel the round and open a new one.
2. **Where:** `RoundsService.updateOpenRound`, the round-state owner, inside `inRoundTx` with `lockRoundForUpdate`. It's not a status transition, but it changes what a close decides, so it serialises with join, leave, close and cancel.
3. **Tiers are replaced as a set** (delete + create in the same transaction). Pledges and `unitsCount` stay as they are, and the price is derived on read (ADR-0010).
4. **Jobs (revised after V2):** the edit commits first. The jobs are then moved with BullMQ `changeDelay`, which is atomic and leaves no remove-then-add gap. A job that is already waiting or running is left alone. If the move fails, the API answers 503 "saved, … save again to retry", and the close job still heals itself (§5). A deadline pulled inside the 24 h reminder lead fires the reminder **now** instead of dropping it, and the dedupe key stops it being sent twice. An edit is refused once the deadline has passed and the close is under way (409).
5. **Deadline-aware close (revised after V2 P1-1):** the deadline processor calls `closeRound(id, '', { onlyIfDue: true })`, which closes only when `deadline <= now + 5 s` under the lock. If the round isn't due (an extension raced a job that was already running, or the worker's clock is ahead), the processor **re-arms the same job** for the round's real deadline (`job.moveToDelayed` + `DelayedError`) instead of finishing. A finished job is removed, and nothing else would close the round. A manual close is unchanged.
6. **No resident notification** of an edit in v1.

## Confidence
**Level:** High for the shape and the locking. Med for "no notification": moving a deadline earlier could surprise participants.

## Research depth
**Judgment call.** Based on a read of `RoundsService`, both schedulers and the notification dedupe.

## Revisit trigger
The owner asks for residents to be told about edits, or wants closed rounds (e.g. CLOSED_MET before assignment) to be editable.
