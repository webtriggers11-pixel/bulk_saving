# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-16
- **Goal:** Brainstorm → architecture → Loop bootstrap → CHORE-001 scaffold → FEAT-001 (onboarding + phone-OTP auth).
- **Result:** complete — CHORE-001 and FEAT-001 both built, verified (V1/V2/V3), and committed.

## Verification evidence

- FEAT-001 close: `bash scripts/verify.sh` exit 0 ×2 back-to-back, identical —
  web 13 tests / 6 files, backend 27 tests / 9 suites. Not flaky.
- Independent V2: backend CHANGES REQUESTED → security fixes applied → re-verified;
  frontend APPROVE. Tenant isolation + refresh single-flight verified genuine.

## Unverified assumptions

- Real SMS provider not yet chosen — v1 uses the stub adapter (its own ADR at pre-launch).
- Auth pre-launch hardening (per ADR-0007 revisit trigger): per-IP/device OTP limits, refresh theft-detection.

## Decisions made this session

- ADR-0002 (monorepo/stack), ADR-0003 (multi-tenancy), ADR-0004 (round concurrency),
  ADR-0005 (Prisma), ADR-0006 (Docker Compose dev), ADR-0007 (phone-OTP + JWT rotating refresh),
  ADR-0008 (hand-rolled shadcn-style UI primitives).

## Open P2 follow-ups (triage as a CHORE when convenient)

- Remove vestigial `society` field from the web auth store (set null on login, unused).
- Add component tests for HomePage (/me render) and AnonymousRoute redirect.
- Relocate/remove leftover CHORE-001 demo files (src/api/health.ts, src/store/ui.store.ts).
- Adopt the shadcn CLI + deps when richer components are needed (ADR-0008 revisit).

## Blockers

- None. Docker infra (Postgres 5442 / Redis 6399) is up; `docker compose up -d` to restore.
  Run `pnpm --filter backend seed` to create societies + super-admin for manual testing.

## Next safe action

Triage-open **FEAT-002 — Service catalog per society**: define the `Service` (master) and
per-society `ServiceOffering` model, admin-managed, and the resident-facing catalog list
scoped to their society. Then FEAT-003 (group-buy rounds — the core mechanic) builds on it.
Write FEAT-002 spec.md → approve → plan → tasks.
