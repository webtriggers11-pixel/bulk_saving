# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-17
- **Goal:** Close FEAT-004 (resumed), then build FEAT-005 super-admin dashboard.
- **Result:** complete. FEAT-004, FEAT-005, BUG-001 and BUG-002 are all built, V2-approved, V3 double-run green and closed.

## Verification evidence

- Final V3: `bash scripts/verify.sh` exit 0 ×2 back-to-back, identical: backend 193 tests / 18 suites, web 50 / 16 files.
- V2 for FEAT-005: independent backend and frontend reviewers both APPROVE (P2s only; the key ones were fixed before close).

## Unverified assumptions

- Real SMS provider not chosen (stub adapter); auth pre-launch hardening (ADR-0007 revisit trigger).
- Close-job reconciliation runs only at boot (FEAT-004 follow-up).
- BUG-001: a 30s round transaction timeout can pressure the DB pool on very hot rounds (revisit trigger in the report).
- ADR-0012 per-resident payment granularity is Medium confidence; revisit after real ops.

## Needs the owner

- **Dev DB migration history:** `_prisma_migrations` holds a rolled-back FEAT-004 attempt with a stale checksum, so `prisma migrate dev` demands a full dev DB reset. Committed migrations are consistent (a fresh DB and CI are fine; checked against a shadow DB). Choose: delete that single rolled-back row, or reset the dev DB and reseed. Until then, apply new migrations with `migrate diff` + `migrate deploy`.

## Open P2 follow-ups (triage as CHOREs)

- FEAT-005: SQL-side dashboard aggregation; stale action errors; client-side length/deadline checks; detail tests for CLOSED_EXPIRED/RATED/CANCELLED; act() warnings; role taken from the login snapshot; runtime pick for TransitionData.
- FEAT-004: periodic reconciliation sweep; dedicated test DB/Redis; a deadline-edit path must cancel() then schedule().
- FEAT-003: 5 P2s in its tasks.md. FEAT-001: vestigial `society` in the web auth store; HomePage/AnonymousRoute tests; leftover demo files.

## Blockers

- None. Docker infra (Postgres 5442 / Redis 6399) is up. Seed: `pnpm --filter backend seed` (the super-admin phone is printed by the seed).

## Next safe action

Open **FEAT-006 — Notifications (SMS-first)**: queued (BullMQ) non-OTP sends through the existing `NotificationChannel`: join confirmation, "round closing soon", round closed met/expired, vendor assigned, delivered. Keep the stub SMS adapter. Choosing a real provider costs money, so it is an owner decision and gets its own ADR. Write spec → ADR → plan → tasks.
