# BUG-010 — A resident is shown the wrong price for a delivered round

**Status:** done (closed 2026-10-17) · **Priority:** P1 · **Opened:** 2026-09-19 · **Found by:** CHORE-009's browser pass

## Symptom

A round was walked through its lifecycle: the admin assigned a vendor at a negotiated
**₹700 per unit**, and marked it delivered. The resident's My Requests card says
**"Price per AC unit — ₹900"**.

₹900 is `currentPrice`, the tier price the round reached while it was open. ₹700 is
`finalPrice`, what the admin actually negotiated and what `amountDue` is computed from
(ADR-0012). The resident is being shown a number that is not what they owe.

## Why it is not fixed in CHORE-009

`RoundDto` — and therefore `MyRoundDto` — carries no `finalPrice` (packages/shared/src/index.ts).
The admin DTO has it; the resident one does not. So there is nothing for the frontend to
render, and guessing is not an option when the number is money. Closing this needs a shared
DTO field and a backend mapper change, which CHORE-009 was explicitly scoped out of.

## What closing it looks like

1. Add `finalPrice: number | null` to the resident round DTO and its mapper.
2. My Requests shows the final price once it exists, labelled as final, and the tier price
   before that.
3. A test at each level: mapper, and the resident card for an ASSIGNED/DELIVERED round.

## Evidence

`GET /rounds/mine` for the delivered round: `{"status":"DELIVERED","currentPrice":900}` —
no finalPrice field at all. The admin's view of the same round shows ₹700.
