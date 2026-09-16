# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-16
- **Goal:** Brainstorm the Bulk Saving product, design architecture, and bootstrap the Loop framework onto it.
- **Result:** partial — planning + doc bootstrap complete; scaffold execution blocked on approval.

## Verification evidence

— No code written this session (docs only). `scripts/verify.sh` still unconfigured
by design until CHORE-001 scaffolds the apps. Spec-review of BRIEF.md: 0 P0 / 0 P1.

## Unverified assumptions

- pnpm is available/acceptable on the dev machine (open question in CHORE-001).
- Local Postgres + Redis available, or Docker Compose acceptable (open question in CHORE-001).
- Footprint "10+ societies" target — treat first 1–3 as a proving ground (BRIEF risk R5).

## Decisions made this session

- ADR-0002 (pnpm monorepo / stack layout), ADR-0003 (shared-schema multi-tenancy),
  ADR-0004 (Postgres-authoritative round concurrency), ADR-0005 (Prisma over TypeORM).

## Blockers

- **CHORE-001 execution needs human approval** — scaffolding installs dependencies
  (CLAUDE.md: "Ask the human before adding any dependency").
- Two open questions in CHORE-001/spec.md (pnpm confirmation; dev DB/Redis via Docker vs local).

## Next safe action

Answer the two CHORE-001 open questions and approve dependency install, then execute
CHORE-001 tasks T1→T11 (scaffold monorepo, wire verify.sh). After it closes, triage
opens FEAT-001 (society onboarding + phone-OTP auth).
