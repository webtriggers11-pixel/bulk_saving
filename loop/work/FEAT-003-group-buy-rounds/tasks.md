# Tasks FEAT-003 — Group-buy rounds

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-003): ...`) AND append a LOG.md entry.

## Backend (chunk 1) — DONE (commit 3aca323; verify.sh exit 0, 71 backend tests; V2 fix applied)
- [x] T1: Prisma Round/RoundTier/RoundParticipant + RoundStatus; partial-unique (societyId,serviceId) WHERE status=OPEN; migration clean.
- [x] T2: `packages/shared` — RoundDto, RoundTierDto (+ Create/Join bodies); consumed by backend.
- [x] T3: Admin POST /admin/rounds (validated; 409 ROUND_ALREADY_OPEN) + POST /admin/rounds/:id/close. SUPER_ADMIN; 403/duplicate/validation tests.
- [x] T4: GET /rounds (authed, society-scoped) — currentPrice/nextTier/myUnits; 7 pricing unit tests + isolation test.
- [x] T5: POST /rounds/:id/join — atomic tx (row-locked); ROUND_CLOSED / cross-society 404 tested.
- [x] T6: PATCH/DELETE join — atomic delta under row lock; multi-resident (20→210) + same-resident concurrency tests.
- [x] T7: Seed demo AC round in GREEN001 (5→₹900, 10→₹700, ~7d); idempotent.
- [x] SEC (V2): SELECT ... FOR UPDATE row lock serializes all round mutations; status-guarded increment; close() serialized; units @Max(50).

## Frontend (chunk 2, React PWA) — DONE (verify exit 0; web 25 tests; V2 APPROVE)
- [x] T8: rounds.api.ts + useRounds hooks (list + join/update/leave mutations; invalidate ['rounds']; refetchInterval 20s + focus for live count).
- [x] T9: /rounds screen — cards (service, progress vs next threshold, currentPrice ₹, "unlocks ₹X at N"/"Best price unlocked", deadline countdown, join/units control reflecting myUnits, units 1–50); loading/error/empty; linked from home ("Group buys").
- [x] T10: Frontend tests — RoundsPage (list render + Join args + refetch + empty) + formatCountdown (fixed-clock). web 25 tests.

## Close — DONE
- [x] T11: V2 independent review — backend CHANGES REQUESTED (same-resident concurrency drift) → row-lock fix → re-verified; frontend APPROVE. Reviewers ran verify.sh themselves.
- [x] T12: V3 double-run by closer — both exit 0, identical (backend 71, web 25), not flaky.

## Known P2 follow-ups (from V2 — non-blocking, triage later)
- Backend: hot-round single-row-lock serialization is the ADR-0004 documented trade-off (revisit only at high scale).
- FE P2-1: join-failure error copy says "update" in the not-yet-joined branch (cosmetic).
- FE P2-2: no per-error-code messaging (e.g. ROUND_CLOSED on a stale card) — generic retry only.
- FE P2-3: update/leave/error-state/top-tier branches lack dedicated tests (required assertions present).
- FE P2-4: tierProgress denominator not floored at current tier (bar under-represents in-tier progress; cosmetic).
