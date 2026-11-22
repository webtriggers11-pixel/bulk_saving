# FEAT-039: A reason for cancelling a round, and reopening a cancelled round

**Status:** done · **Priority:** P1 · **Owner:** owner ("While cancelling the round, there should be a reason … Also, cancel round can be reopened") / agent · **Opened:** 2026-11-23

## Acceptance criteria
- [x] AC1 — Migration (additive): `Round.cancelReason String?`, `Round.cancelledAt DateTime?`, `Round.reopenCount Int @default(0)`, plus the enum value `NotificationType.ROUND_REOPENED`.
- [x] AC2 — `POST /admin/rounds/:id/cancel {reason}`: the reason is required (3–300 characters, trimmed); otherwise 400. It is stored with `cancelledAt`. The admin round page and the rounds list show it. Residents see it in the app (My Requests: "Cancelled: <reason>"). The SMS template stays fixed (no free text in SMS).
- [x] AC3 — `POST /admin/rounds/:id/reopen {deadline}`: CANCELLED → OPEN, only for a round that was never assigned (no vendor) and has no collected payments. The deadline must be in the future. Returns 409 `ROUND_ALREADY_OPEN` if the society already has an open round for that service. It clears the reason, increments `reopenCount`, and schedules the close job and reminder in the transaction. Pledges are kept. Their owners get ROUND_REOPENED ("open again until <date>; your pledge of N stands; leave any time before then").
- [x] AC4 — Dedupe keys include the reopen cycle once `reopenCount > 0`, so a re-cancel, a re-close or a second "closing soon" after a reopen is delivered, not swallowed.
- [x] AC5 — Web: the Cancel sheet has a required reason field. A CANCELLED round's page shows the reason and a **Reopen round** card (deadline field) when it can be reopened, or says why it can't.
- [x] AC6 — Tests + gate; V2; V3.
