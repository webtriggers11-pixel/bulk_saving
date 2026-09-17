# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-18
- **Goal:** FEAT-006 (notifications), then the owner asked to exercise the whole
  application end to end, fix what broke, and keep looping. Then FEAT-007.
- **Result:** complete. **FEAT-006, CHORE-002, CHORE-003 and FEAT-007 are all closed**
  (each V2-reviewed and V3 double-run). BUG-003 (CORS) was carried into git by this
  session and closed by the session that authored it. The v1 feature set from BRIEF.md is
  now complete except **FEAT-008 (PWA shell)**, in flight in a parallel session.

> **Another session was working in this repo at the same time.** It closed BUG-003
> and is mid-build on **FEAT-008 (PWA shell, ADR-0015)** — uncommitted files under
> `apps/web/src/features/shell/`, `apps/web/src/vite-env.d.ts`,
> `apps/web/src/test/pwa-register.stub.ts`, `apps/web/vite.config.ts`. Nothing in this
> handoff describes FEAT-008's state; ask that session or read its work folder.

## End-to-end state (the owner's "test everything" ask)

`node scripts/e2e-smoke.mjs` (CHORE-003) drives the REAL HTTP API of a running server —
onboarding/OTP, catalog, the full round lifecycle, illegal-transition refusals, tenant
isolation, rating, dashboard aggregates. **77/77 checks, 11 scenarios, no application
bugs found.** `verify.sh` cannot cover this: it drives Nest in-process, so bootstrap, the
global wiring, CORS, the HTTP stack and the queues are never exercised assembled.

To run it: backend with `PORT=3100 OTP_DEV_LOG=true pnpm --filter backend dev`, then
`node scripts/e2e-smoke.mjs`. It logs in through the CHORE-002 dev OTP echo, so that flag
is required.

**Browser-level E2E is still NOT done.** The Claude-in-Chrome extension could not load any
localhost page — including the other session's dev server — so it is an extension
site-permission problem, not an application one. **This needs the owner**: grant the
extension access to `localhost` / `127.0.0.1`. Until then the resident UI is covered only
by Vitest component tests, never a real browser.

## What FEAT-007 shipped

Backend only (`apps/web` belongs to FEAT-008 while it runs). Ratings hang off the ROUND,
one per participant (ADR-0017); the FIRST rating flips DELIVERED → RATED through the
guarded transition. `PUT`/`DELETE /rounds/:id/rating`, plus **`GET /rounds/mine`** — the
"My Requests" read, without which a resident cannot even see a delivered round. Admin gets
per-participant ratings, per-round summary, per-vendor average + count, and the dashboard
metric the BRIEF names as the success signal.

**The V2 reviewer reproduced a real bug on a live server**: two participants rating the
same round at once both saved, but the loser of the status race got a 409 for a write that
had succeeded — and that is the designed traffic pattern, since the delivered SMS asks
everyone to rate at the same moment. Fixed with `markRatedIfDelivered()` (re-decides under
the row lock); the regression test was confirmed to fail against the old code before being
kept.

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

- **V3 (FEAT-007, at HEAD 15ca284):** `verify.sh` exit 0 twice back-to-back, identical —
  **backend 287 tests / 22 suites, web 92 / 25 files**. Live E2E 77/77.
- **V2:** every closed item this session was reviewed by an independent subagent that ran
  `verify.sh` itself. All returned CHANGES REQUESTED with **no P0**; every P1 was fixed
  before close (details in each work item's `tasks.md`).

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
- **Ratings are API-only.** No admin screen shows an average and no resident screen can
  leave one, because `apps/web` is FEAT-008's. FEAT-007's user stories 4–6 are true at the
  contract level and not on anyone's screen yet.
- Nobody has used this product in a browser this session. Every claim above rests on the
  test suites and the HTTP-level E2E.

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

**The rating UI** — resident (rate a delivered job from "My Requests") and admin (show
`averageRating` / `ratingCount` on the vendor list and the round detail). The API is done
and tested; only the screens are missing. **Do not start until FEAT-008 lands**, because
it owns `App.tsx`, the nav and the resident pages — coordinate with that session first
(it is `bulk-saving-82`; it has been told `GET /rounds/mine` exists for its My Requests
tab).

If FEAT-008 is still running, the next safe thing that touches nothing contested is the
browser E2E, which needs the owner to grant the Chrome extension localhost access.
