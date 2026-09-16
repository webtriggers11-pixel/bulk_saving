# Plan FEAT-003 — Group-buy rounds

**Derived from:** spec.md · **Approved by:** autonomous (owner directive) — 2026-09-16

## Technical approach

A `rounds` module (Round + RoundTier + RoundParticipant via Prisma). Admin opens/closes
rounds; residents view + join/update/leave. The join path is the ADR-0004 concurrency
critical section: an atomic `prisma.$transaction` updates the participant row and the
round's `unitsCount` together, then recomputes current tier from the new count. Resident
reads are tenant-scoped by JWT societyId. Frontend: a `/rounds` screen with live round
cards + join control, TanStack Query + polling. Built in two chunks: backend (T1–T7) then
PWA (T8–T11), each verified; V2 + V3 close.

## Data model / contracts

**Prisma** (ADR-0010):
- `Round { id, societyId FK, serviceId FK, status RoundStatus @default(OPEN), unitsCount Int @default(0), deadline DateTime, createdAt, updatedAt }` — partial unique index (societyId, serviceId) WHERE status='OPEN'.
- `RoundTier { id, roundId FK, threshold Int, price Int }`.
- `RoundParticipant { id, roundId FK, residentId FK, units Int, createdAt, updatedAt, @@unique([roundId, residentId]) }`.
- enum `RoundStatus { OPEN CLOSED }` (FEAT-004 extends with the full lifecycle).

**Shared types:** `RoundDto` (id, service summary, status, unitsCount, currentPrice, nextTier?, deadline, tiers[], myUnits), `RoundTierDto`.

**Endpoints:**
- Admin: `POST /admin/rounds`, `POST /admin/rounds/:id/close`.
- Resident: `GET /rounds`, `POST /rounds/:id/join`, `PATCH /rounds/:id/join`, `DELETE /rounds/:id/join` (all society-scoped by JWT).

**Pricing:** `currentPrice` = price of the highest tier with threshold <= unitsCount (or the first/base tier if none met — define: below the lowest threshold, show the lowest tier's price as the starting price and mark it not-yet-unlocked). Keep the rule explicit + unit-tested.

**Seed:** open a demo AC Servicing round in GREEN001 with tiers (e.g. 5→₹900, 10→₹700) and a deadline ~7 days out.

## New decisions required
- **ADR-0010** (admin-opened rounds, units join, one-open-per-service) — written, Accepted.
- ADR-0003 (tenancy) + ADR-0004 (Postgres-authoritative concurrency) apply directly.

## Risks
- **Concurrency correctness (highest risk):** joins/updates/leaves must mutate `unitsCount`
  atomically with the participant row in one transaction; recompute count from participants
  (or increment/decrement by delta) without lost updates. Dedicated concurrent-join integration
  test asserting exact final count is mandatory (acceptance criterion).
- **Partial-unique for one-open-round-per-service:** Prisma partial unique index — verify the
  migration creates it and a second POST returns ROUND_ALREADY_OPEN (not a 500).
- **Tenant leak:** round reads/joins scoped by JWT societyId only; isolation test required.
- **Price-tier boundary logic:** below lowest threshold / exactly-on-threshold / above highest — unit-test each.

## Task outline (see tasks.md)
Backend T1 model+migration · T2 shared DTOs · T3 admin open/close · T4 GET /rounds (scoped, tier calc) ·
T5 join (atomic) · T6 update/leave (atomic) + concurrency test · T7 seed.
Frontend T8 rounds API+hooks · T9 /rounds screen + join control · T10 FE tests. Close T11 V2 · T12 V3.
