# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-18
- **Goal:** Build FEAT-006 — notifications, SMS-first.
- **Result:** complete. FEAT-006 is built, V2-reviewed by two independent reviewers,
  fixed, V3-verified and **closed**. BUG-003 (CORS) was carried into git by this
  session and has since been closed by the session that authored it.

> **Another session was working in this repo at the same time.** It closed BUG-003
> and is mid-build on **FEAT-008 (PWA shell, ADR-0015)** — uncommitted files under
> `apps/web/src/features/shell/`, `apps/web/src/vite-env.d.ts`,
> `apps/web/src/test/pwa-register.stub.ts`, `apps/web/vite.config.ts`. Nothing in this
> handoff describes FEAT-008's state; ask that session or read its work folder.

## What FEAT-006 shipped

Backend only — **no `apps/web` change, no new dependency**. Transactional outbox
(ADR-0013): a `Notification` row is staged **inside the same transaction as the round
change**, dispatched to BullMQ only after commit, one job per recipient, with a
DB-unique `dedupeKey`. Seven lifecycle messages (joined, closing-soon, closed-met,
closed-expired, assigned, delivered, cancelled), a send processor (PENDING-only guard,
retries, FAILED + `lastError`), a boot reconciler, and a `deadline − 24h` reminder that
fans out at fire time to whoever has joined by then. OTP delivery is untouched:
synchronous, direct, never persisted.

## Verification evidence

- **V3:** `bash scripts/verify.sh` exit 0 three times back-to-back. Backend — all of
  FEAT-006's scope — identical every run: **257 tests / 21 suites**.
- Web counts rose across those runs (16 files/50 → 17/52 → 19/57). That is **not
  flakiness**: the parallel session was landing FEAT-008 web tests between runs. No test
  failed in any run.
- **V2:** two independent reviewers, both CHANGES REQUESTED, **no P0**; all P1s and most
  P2s fixed before close (see `loop/work/FEAT-006-notifications-sms/tasks.md`).

## Unverified assumptions

- **Delivery is at-least-once, not exactly-once.** Staging is exactly-once; a send that
  succeeds before its `markSent` write can be retried and go out twice. Accepted for v1,
  recorded in ADR-0013's amendment.
- The stub SMS adapter still sends nothing. No message has been seen by a real phone.
- The 24h reminder lead is a judgment call with no ops data behind it.
- PENDING rows are reconciled **only at boot**, and rows older than 24h are deliberately
  skipped as stale — a long Redis outage without a restart delays or drops lifecycle SMS.
- `commit 4000cc2` does not build standalone (its test helper imports `src/bootstrap.ts`,
  which landed in the next commit). HEAD is fine; history was left intact because another
  session shares the repo. Verify at HEAD, not per-commit.

## Needs the owner

- **Real SMS provider** (MSG91 / Twilio / Gupshup): costs money, so it is your call and
  needs its own ADR. Note Indian transactional SMS requires **DLT-registered templates
  with fixed variable slots** — the current free-form bodies must be restructured before
  a real sender ID can carry them.
- **`Notification` has no `societyId`**, against CLAUDE.md's "every tenant-scoped row
  carries `societyId`". It is scoped transitively via `residentId` (same shape as
  `RoundParticipant`). Denormalising later means a migration plus a backfill — decide
  before volume. Recorded in ADR-0013's amendment and ARCHITECTURE.md § Multi-tenancy.
- **Dev DB migration history** (unchanged from last session): `_prisma_migrations` holds
  a rolled-back FEAT-004 attempt with a stale checksum, so `prisma migrate dev` still
  demands a full dev-DB reset. Committed migrations are consistent. Until you choose
  (delete that one row, or reset and reseed), apply new migrations with
  `migrate diff` + `migrate deploy` — which is how FEAT-006's migration was applied,
  with your approval.

## Open P2 follow-ups (triage as CHOREs)

- FEAT-006: `dispatch()` is a sequential per-recipient loop (`queue.addBulk` makes a
  200-participant fan-out one round-trip); `clamp()` truncates from the END so a
  pathological name could cut the rupee amount off a money message; no message offers a
  reply/help route; DELIVERED does not restate the amount owed; "units" is internal
  jargon in a resident-facing SMS; the deadline-driven closer does not cancel a pending
  reminder (harmless — it has already fired).
- Earlier items unchanged: FEAT-005's six, FEAT-004's three (periodic reconciliation
  sweep, dedicated test DB/Redis, deadline-edit must cancel() then schedule()),
  FEAT-003's five, FEAT-001's three.

## Blockers

- None for FEAT-006. Docker infra (Postgres 5442 / Redis 6399) is up. Seed:
  `pnpm --filter backend seed`.

## Next safe action

**FEAT-007 — post-service rating** is the only P1-adjacent item left in the build order
(FEAT-008 is already in flight elsewhere — check before starting anything in `apps/web`).
The groundwork exists: `RoundsService.markRated()` and the `DELIVERED → RATED` transition
are already implemented and tested, and ADR-0012 put the vendor on the round so a rating
can reference it. Open it through triage: spec → ADR → plan → tasks.
