# Tasks FEAT-003 — Group-buy rounds

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-003): ...`) AND append a LOG.md entry.

## Backend (chunk 1)
- [ ] T1: Prisma `Round` + `RoundTier` + `RoundParticipant` + `RoundStatus` enum; partial-unique (societyId, serviceId) WHERE status=OPEN; migration clean. — depends: —
- [ ] T2: `packages/shared` — `RoundDto`, `RoundTierDto`; consumed by backend. — depends: T1
- [ ] T3: Admin — `POST /admin/rounds` (validate offering enabled, tiers ascending/positive, no existing OPEN → else `ROUND_ALREADY_OPEN`) + `POST /admin/rounds/:id/close`. SUPER_ADMIN. Integration tests (create, duplicate-open, 403 resident). — depends: T2
- [ ] T4: `GET /rounds` (authed) — OPEN rounds for JWT society; compute currentPrice/nextTier from unitsCount; include myUnits. Unit tests for tier-boundary logic; integration test + tenant-isolation. — depends: T2
- [ ] T5: `POST /rounds/:id/join` {units>=1} — atomic tx: upsert participant + set unitsCount; ROUND_CLOSED if closed; cross-society → 404. Integration tests. — depends: T4
- [ ] T6: `PATCH`/`DELETE /rounds/:id/join` — atomic delta update/decrement; + CONCURRENCY test: N parallel joins → unitsCount == exact sum (no lost updates). — depends: T5
- [ ] T7: Seed — open a demo AC Servicing round in GREEN001 (tiers 5→₹900, 10→₹700, deadline ~7d); idempotent. — depends: T1

## Frontend (chunk 2, React PWA)
- [ ] T8: Rounds API client + TanStack Query hooks (list + join/update/leave mutations with invalidation/polling). — depends: T5
- [ ] T9: `/rounds` screen — round cards (service, progress vs next threshold, currentPrice, "unlocks ₹X at N", deadline countdown, join/units control reflecting myUnits); loading/error/empty; linked from home. Mobile-first, ADR-0008 primitives. — depends: T8
- [ ] T10: Frontend tests (Vitest + RTL) — round list renders w/ tier + count (mocked API), join mutation flow, empty state. — depends: T9

## Close
- [ ] T11: V2 independent review — concurrency + tenant-isolation + tier-math scrutiny; reviewer runs verify.sh itself. — depends: T1–T10
- [ ] T12: V3 fresh double-run of verify.sh; log both; close (REGISTRY → done, commit). — depends: T11
