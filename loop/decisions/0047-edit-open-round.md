# ADR-0047: Editing an open round: deadline and tiers only, under the round lock, deadline-aware close job

**Status:** Accepted · **Date:** 2026-11-23 · **Deciders:** owner ("not able to edit it … update that"), agent · **Work item:** FEAT-038 · **Builds on:** ADR-0004 (row lock, Postgres authoritative), ADR-0010 (tiers), ADR-0011 (deadline close job), ADR-0013 (reminders, dedupe)

## Decisions
1. **What's editable:** deadline and tiers, and only while the round is **OPEN**. After it closes, the tiers decide whether it met its target and the price residents pay, so changing them would rewrite an outcome. Society and service are fixed, because pledges and asks belong to that pair. To change those, cancel the round and open a new one.
2. **Where:** `RoundsService.updateOpenRound`, the round-state owner, inside `inRoundTx` with `lockRoundForUpdate`. It's not a status transition, but it changes what a close decides, so it serialises with join, leave, close and cancel.
3. **Tiers are replaced as a set** (delete + create in the same transaction). Pledges and `unitsCount` stay as they are, and the price is derived on read (ADR-0010).
4. **Jobs:** a deadline change cancels and re-schedules the close job and the reminder inside the transaction, so a Redis failure rolls the edit back. If the re-schedule fails after the cancel, the boot reconciler re-ensures every OPEN round has a close job (ADR-0011). Already-sent reminders aren't repeated, because of the `ROUND_CLOSING_SOON:<round>:<resident>` dedupe key.
5. **Deadline-aware close:** the deadline job calls `closeRoundIfDue`, which closes only when `deadline <= now + 5 s` under the lock. A job that was already running when the deadline was extended (BullMQ can't remove an active job) becomes a no-op. A manual close is unchanged.
6. **No resident notification** of an edit in v1.

## Confidence
**Level:** High for the shape and the locking. Med for "no notification": moving a deadline earlier could surprise participants.

## Research depth
**Judgment call.** Based on a read of `RoundsService`, both schedulers and the notification dedupe.

## Revisit trigger
The owner asks for residents to be told about edits, or wants closed rounds (e.g. CLOSED_MET before assignment) to be editable.
