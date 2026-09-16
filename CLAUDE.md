# Agent Operating Manual

<!-- PROCESS SECTION — permanent, do not change per stack -->

## First session?

If `STACK.md` still contains `{{...}}` placeholders, STOP and run the
**bootstrap** skill before doing anything else.

## Structure

This project runs on the Loop Engineering Framework — layout contract and
invariants live in `loop/framework.md`. Application code goes ONLY in
`apps/<layer>/`; process state goes ONLY in `loop/`. Never mix them.

## Commands

All verification goes through ONE entrypoint — never call test runners directly:

- Verify: `bash scripts/verify.sh` — MUST pass before any task is marked done
- Run / dev / build commands: see `STACK.md`

## Workflow rules

1. ALL new work enters through the **triage** skill — classify (FEAT/BUG/CHORE),
   assign an ID from `loop/REGISTRY.md`, create the work folder, THEN route to
   **new-feature** or **fix-bug**. No untracked work, ever.
2. Features: no code before an approved plan. Bugs: no fix before a failing test.
3. Every technical choice gets an ADR (**write-adr** skill) with honest
   **Confidence** (High/Med/Low) and **Research depth** (deep research / quick
   check / judgment call). Low confidence → mandatory revisit trigger; consider
   the **stack-researcher** subagent before asking for approval. Read existing
   ADRs first; don't re-litigate settled decisions.
4. Work task-by-task from the active `loop/work/<ID>-*/tasks.md`, checking boxes.
5. **Three verification checkpoints per work item — each logged to loop/LOG.md:**
   - **V1 (per task):** `bash scripts/verify.sh` after every change (the hook
     enforces this). Failure is feedback, not a blocker.
   - **V2 (independent):** the code-reviewer subagent runs verify.sh ITSELF —
     never trusts the implementer's claim — and reviews the diff vs the spec.
   - **V3 (at close):** fresh full run, then run the test suite a SECOND time
     back-to-back; different results between runs = flaky test = a BUG to
     triage, and the item cannot close. Log both run outputs.
6. Implementer never reviews own work — V2 belongs to the **code-reviewer** subagent.
7. Log as you go: append to `loop/LOG.md` (append-only) at every work-item
   open/close, completed task, and decision. Keep `loop/REGISTRY.md` statuses
   current. End every session with the **session-handoff** skill.
8. Commit after each completed task: `feat(FEAT-NNN): ...`, `fix(BUG-NNN): ...`.
9. Every layer in `apps/` has a real test suite wired into verify.sh —
   **a build is not a test** (framework invariant 3).

## Ask the human before

- Adding any dependency
- Deleting files, dropping/altering database tables, changing storage formats
- Any migration, deploy, or action that costs money
- Changing anything in this PROCESS section

<!-- STACK SECTION — filled by the bootstrap skill -->

## Stack

Frontend: React 19 + Vite (PWA) · Backend: NestJS 11 + Prisma · DB: PostgreSQL 16 + Redis 7 (BullMQ) · Tests: Jest (backend) + Vitest (frontend) · Monorepo: pnpm workspaces.

Details, versions, and run commands: see `STACK.md`. Product scope: `BRIEF.md`. Architecture: `ARCHITECTURE.md`.

## Stack conventions

- Monorepo: `apps/backend` (Nest) + `apps/web` (React PWA) + `packages/shared` (types). App code only in `apps/<layer>/`.
- **Multi-tenancy:** every tenant-scoped row carries `societyId`; scoping enforced in the service layer, never trusted from client input (ADR-0003).
- **Rounds are the core domain.** All round `status` transitions go through `RoundService` — never mutate status elsewhere. Unit counts are authoritative in Postgres via atomic transactions; Redis is display/rate-limit only (ADR-0004). Thresholds count units, not people; pricing is tiered.
- **DB access only via Prisma through a service** — no raw SQL in controllers, no Prisma in controllers (ADR-0005).
- **API envelope:** `{ success: true, data }` / `{ success: false, error: { code, message } }` via a global exception filter. Validate every request with a DTO + `class-validator`.
- **Auth:** phone+OTP (OTP in Redis w/ TTL + rate-limit, never logged/returned), JWT access+refresh, roles `RESIDENT | SUPER_ADMIN`.
- **Notifications:** one `NotificationChannel` interface; SMS-first, WhatsApp fast-follow; non-OTP sends queued via BullMQ.
- **Frontend:** feature-based folders; TanStack Query for server state, Zustand for UI/auth only (no server-data duplication); Tailwind + shadcn/ui; TypeScript strict, no `any`.
- Full boundary rules (Always / Ask-first / Never) live in `ARCHITECTURE.md`.
