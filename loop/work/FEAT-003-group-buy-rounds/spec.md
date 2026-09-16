# FEAT-003 — Group-buy rounds (join, units, tiers, live counter)

**Status:** specced (autonomous — decisions baked in) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-16

## Problem / Why

This is the core of Bulk Saving: neighbours pool demand for a service so everyone
gets a bulk discount. A **round** is a time-boxed group-buy for one service in one
society, with tiered pricing that improves as more units are pledged. Residents join
with a number of units; the live count + current tier price create urgency and the
shared deadline solves "everyone wants it at a different time". (Deadline auto-closing +
the full lifecycle state machine are FEAT-004; FEAT-003 delivers create/join/live-count.)

## Decisions baked in (autonomous — see ADR-0010)

- **Rounds are opened by SUPER_ADMIN** for a (society, service) with a deadline + tiers.
  Pricing reflects the vendor deal the admin sets up (manual-ops model). Resident-initiated
  "request a service" demand signalling is a later enhancement (backlog).
- **One OPEN round per (society, service)** at a time.
- **Thresholds count UNITS, not people** (a resident may pledge N units). Tiered pricing:
  current price = the price of the highest tier whose unit threshold is met.
- **Concurrency (ADR-0004):** Postgres authoritative; joins mutate the unit count inside an
  atomic transaction. Redis is not required for correctness here (display via polling).
- Live updates in v1 via TanStack Query polling/refetch (websockets later).

## User stories

1. As a **super-admin**, I open a round for a service in a society with a deadline and
   price tiers, so residents can pool demand.
2. As a **resident**, I see the open rounds in my society with the live count, current
   price, next tier, and deadline — and I join with a number of units.
3. As a **resident**, I can change my pledged units or leave while the round is open.

## Acceptance criteria (testable — this IS the definition of done)

**Domain model**
- [ ] Prisma `Round` (id, societyId FK, serviceId FK, `status` enum OPEN|CLOSED (full
      lifecycle in FEAT-004), `unitsCount` Int @default(0) [authoritative cache], `deadline`
      DateTime, createdAt, updatedAt) + partial unique so only one OPEN round per (societyId, serviceId).
- [ ] `RoundTier` (id, roundId FK, `threshold` Int units, `price` Int) — ordered.
- [ ] `RoundParticipant` (id, roundId FK, residentId FK, `units` Int (>=1), createdAt,
      updatedAt, `@@unique([roundId, residentId])`).
- [ ] Migration applies cleanly.

**Admin — open/close rounds**
- [ ] `POST /admin/rounds` (SUPER_ADMIN): { societyId, serviceId, deadline, tiers[] } creates
      an OPEN round; rejects if an OPEN round already exists for that (society, service) →
      `ROUND_ALREADY_OPEN`; validates the service is offered+enabled in that society; tiers
      non-empty, thresholds ascending, prices positive.
- [ ] `POST /admin/rounds/:id/close` (SUPER_ADMIN) sets status CLOSED (interim manual close;
      FEAT-004 adds deadline-driven auto-close + full lifecycle).

**Resident — view + join (tenant-scoped)**
- [ ] `GET /rounds` (authed) lists OPEN rounds for the caller's society (societyId from JWT),
      each with: service info, `unitsCount`, `currentPrice` (highest met tier or base), the
      next tier (threshold + price) if any, deadline, tiers[], and the caller's own pledged units.
- [ ] `POST /rounds/:id/join` { units>=1 } — records/updates the caller's participation and
      increments the round's unit count **atomically** (ADR-0004); returns the updated round
      view. Joining a round in another society → 404 (tenant-scoped). Joining a CLOSED round →
      `ROUND_CLOSED`.
- [ ] `PATCH /rounds/:id/join` { units } updates the caller's pledged units (delta applied
      atomically); `DELETE /rounds/:id/join` removes participation and decrements atomically.
- [ ] **Concurrency:** an integration test fires N concurrent joins and asserts the final
      `unitsCount` equals the exact sum of pledged units (no lost updates / oversell).
- [ ] **Tenant isolation:** a resident cannot view or join a round belonging to another society.

**Frontend (resident PWA)**
- [ ] A `/rounds` screen lists the society's open rounds as cards: service name, a progress
      indicator (units vs next threshold), current price, "unlocks ₹X at N units" hint,
      deadline countdown, and a Join control (choose units). Reflects the caller's current pledge.
- [ ] Join / update / leave via TanStack Query mutations; the card refreshes the live count
      (query invalidation / polling). Loading/error/empty states. Mobile-first, primitives per ADR-0008.

**General**
- [ ] DTO + class-validator; standard envelope; DB access only via services; TS strict, no `any`.
- [ ] Seed: open one demo round (e.g. AC Servicing in GREEN001) with a couple of tiers + a deadline.
- [ ] `bash scripts/verify.sh` passes (unit + integration incl. concurrency + isolation tests).

## Out of scope (FEAT-004+ / later)

- Deadline-driven auto-closing + the full lifecycle (OPEN→CLOSED_MET/EXPIRED→ASSIGNED→
  DELIVERED→RATED→CANCELLED) and BullMQ scheduler — that is FEAT-004.
- Vendor assignment, final pricing, payment marking — FEAT-005 (admin dashboard).
- Ratings — FEAT-007. Real-time websockets — later (v1 polls).
- Resident-initiated round creation / demand signalling — backlog.

## Open questions
- None blocking (decisions baked in above). Revisit ADR-0010 if resident-initiated rounds become desired.
