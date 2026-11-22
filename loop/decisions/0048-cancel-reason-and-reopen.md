# ADR-0048: Cancelling needs a reason; a cancelled round can be reopened (CANCELLED → OPEN), with cycle-aware message dedupe

**Status:** Accepted · **Date:** 2026-11-23 · **Deciders:** owner, agent · **Work item:** FEAT-039 · **Amends:** ADR-0011 (state machine: CANCELLED is no longer terminal), ADR-0013 (dedupe keys)

## Decisions
1. **Reason:** it is required on cancel (3–300 characters) and stored on the round (`cancelReason`, `cancelledAt`). It is shown to admins and in the app to residents. It is **not** put into the SMS. Free text in SMS breaks fixed (DLT-style) templates and length limits.
2. **Reopen:** a new legal transition, CANCELLED → OPEN, reachable only through `RoundsService.reopen`. The guard: no vendor was ever assigned (`vendorId` null) and no payment is collected. A round cancelled after assignment has vendor and payment history and stays terminal; to run it again, open a new round. It needs a future deadline. The one-OPEN-per-pair partial unique index decides conflicts (P2002 → 409 ROUND_ALREADY_OPEN).
3. **Pledges survive a reopen.** Their owners were told "cancelled, nothing to pay", so they get a new ROUND_REOPENED message that says their pledge stands and they can leave before the new deadline. Silently re-committing them would be wrong, and wiping pledges would throw away the demand the admin reopened for.
4. **Dedupe across cycles:** `reopenCount` increments on each reopen. Lifecycle keys become `<TYPE>:<round>:<resident>` in cycle 0 (unchanged, so existing rows stay valid) and `<TYPE>:<round>:<resident>:c<n>` after the nth reopen. Join confirmations are unaffected (they're keyed per participant).
5. **Jobs:** reopen MOVES the close job and reminder inside the transaction (`reschedule`, so a job that survived the cancel goes to the new deadline). It needs the same preconditions as create: the service offered and active, and the society active (V2 r3).
6. **Accepted:** a pledger switched off (FEAT-035) while the round was cancelled keeps a counted pledge after a reopen and is messaged like the others, as already happens for OPEN rounds.

## Confidence
**Level:** High for reason and dedupe. Med for the reopen guard ("never assigned"), which is a product call.

## Research depth
**Judgment call.** Based on a read of the transitions, cancel, and notification staging.

## Revisit trigger
The owner wants to reopen assigned rounds, or wants the reason included in the SMS.
