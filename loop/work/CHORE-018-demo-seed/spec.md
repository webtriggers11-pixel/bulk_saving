# CHORE-018 — a demo seed that exercises every screen

**Status:** in-progress · **Priority:** P2 · **Opened:** 2026-10-17 · **Asked by:** owner ("seed some data to test")

## Why

The base seed (`prisma/seed.ts`) creates 2 societies, 1 admin, 5 services and ONE empty
OPEN round. Every other state the product draws — a met round awaiting a vendor, an
expired one, an assigned one with half the payments in, a delivered one waiting for a
rating, a rated one with comments, a cancelled one — only exists if someone clicks the
whole lifecycle through by hand (HANDOFF: `/tmp/scenario*.mjs`, now gone). Testing
the app should start from a database that already holds all of them.

## Scope

- `apps/backend/prisma/seed-demo.ts` + `pnpm --filter backend seed:demo` (runs the base
  seed first, then the demo layer). The base seed is unchanged — the smoke harness
  depends on exactly what it creates.
- Residents in both societies (one primary demo resident, one with no history for empty
  states, a second SUPER_ADMIN so a browser pass does not burn the main admin's OTP quota).
- Vendors (four active, one deactivated).
- Rounds in **every** `RoundStatus`, plus the base AC round given participants.
- Participants with payment flags, ratings with comments, SENT lifecycle notifications.

## Rules the data must obey (the same ones RoundsService enforces)

- `unitsCount` = sum of participant `units`, always recomputed, never hand-typed.
- CLOSED_MET ⇔ units ≥ lowest threshold at close; CLOSED_EXPIRED ⇔ below it.
- ASSIGNED/DELIVERED/RATED carry `vendorId`, `finalPrice`, `assignedAt`; DELIVERED/RATED
  carry `deliveredAt`; payments only exist once a final price does.
- RATED has ≥1 rating; DELIVERED has none (so the demo resident can rate it).
- At most one OPEN round per (society, service) — a demo OPEN round is SKIPPED, with a
  message, if a real one already holds the slot.
- Notifications are seeded as SENT, so the outbox never dispatches them.

## Idempotency

Demo rounds and vendors use fixed `demo_` ids. Each run deletes the `demo_` rounds
(cascading their participants, ratings and notifications) and recreates them, so a
re-run RESETS the demo to its starting state even after someone clicked through it.
Residents are upserted, never deleted. Refuses to run with `NODE_ENV=production`.

## Out of scope

CHORE-011 (smoke-harness leftovers) — the dev DB is fresh today, so there are none to clean.
