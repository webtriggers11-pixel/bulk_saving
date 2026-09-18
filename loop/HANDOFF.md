# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-18
- **Goal:** FEAT-006 (notifications), then the owner asked to complete the application,
  test it end to end with seed data, fix what broke, and keep looping without per-step
  approval.
- **Result:** **every item in `loop/REGISTRY.md` is `done` — 18 of 18, nothing open.**
  The v1 feature set from BRIEF.md is complete. Closed this session: FEAT-006, FEAT-007,
  FEAT-009, BUG-004, CHORE-002, CHORE-003, CHORE-004 (and, by the parallel session,
  BUG-003, FEAT-008, CHORE-005). Each went through V1 → V2 (independent reviewer that ran
  the gate itself) → V3 (double run).

## The single most important caveat

**Nothing in this session has been seen in a real browser.** The Claude-in-Chrome extension
could not load any localhost page — including the other session's dev server — so it is an
extension site-permission problem, not an application one. The rating flow, every offline
state, both admin surfaces and the whole PWA shell are proven by Vitest component tests and
by HTTP-level E2E, never by a human or a browser looking at them.

**This needs the owner:** grant the extension access to `localhost` / `127.0.0.1`, then run
a browser pass over the resident and admin flows.

## Verification contract (changed this session)

`bash scripts/verify.sh` now runs: shared types → prisma client → lint → typecheck →
**build** → tests. The build stage is CHORE-004, **added with the owner's explicit
approval** because it changes the single verification entrypoint.

It justified itself within an hour: moving a constant into `@bulk/shared` and importing it
in the web app broke the **production** Vite build (shared builds to CommonJS, Rollup cannot
see its named exports, and every other web import from it is type-only). Vitest resolved it
happily, so lint, typecheck and 153 tests were green — only the build stage failed.
**Keep anything moved into `@bulk/shared` type-only, or check the build.**

Second entrypoint: `node scripts/e2e-smoke.mjs` (CHORE-003) drives the real HTTP API of a
running server — 77 checks over 11 scenarios, no application bugs found. It needs a backend
started with `PORT=3100 OTP_DEV_LOG=true pnpm --filter backend dev`, because it logs in
through the CHORE-002 dev OTP echo.

## Verification evidence

- **V3 at HEAD:** `verify.sh` ×2 back-to-back on a tree verified quiescent before and after,
  both exit 0 and identical — **backend 287 tests / 22 suites, web 166 / 33 files**.
- Every closed item was reviewed by an independent subagent that ran the gate itself. All
  returned CHANGES REQUESTED; every P0 and P1 was fixed before close.

## What the reviews caught that the suites did not

Worth reading before trusting a green run:

1. **A live P0 in shipped code** (FEAT-009/BUG-004): offline, `/admin/rounds/:id` rendered a
   bare page, and its assign form claimed *"No active vendors. Add a vendor to assign this
   round."* — a false statement caused by a network failure, whose obvious remedy is to
   create a duplicate vendor. **An empty-state string is an assertion about the world and
   needs the same care as an error state.**
2. **Reverting a fix left the whole suite green** — the read-side offline fix had only a unit
   test of its helper. A helper's unit test is not a test of the fix.
3. **A reproduced concurrency bug** (FEAT-007): two residents rating the same round at once
   both saved, but the loser of an unlocked status race got a 409 for a write that had
   succeeded — on exactly the traffic pattern the delivered SMS creates.
4. **`mockRejectedValue` is the server-error path, not the offline path.** TanStack Query v5
   *pauses* offline work (`isPaused`, `fetchStatus === 'paused'`), so offline behaviour must
   be driven with `onlineManager.setOnline(false)`. Every offline claim in this repo now is.
5. **The habit that found the most:** delete or revert the code under test and confirm the
   test goes red. It caught two dead tests and two vacuous ones today.

## Unverified assumptions

- Nobody has used this product in a browser (see above).
- The stub SMS adapter still sends nothing — no message has reached a real phone.
- Lifecycle SMS delivery is **at-least-once**, not exactly-once (ADR-0013 amendment).
- PENDING notifications are reconciled only at boot, and rows older than 24h are skipped as
  stale.
- `RATED` means "at least one resident rated", not "all did" (ADR-0017) — always read the
  count next to the average.
- A queued-offline mutation resumes only while the page stays open; there is no mutation
  persistence, so a reload drops it silently.
- `commit 4000cc2` does not build standalone (its test helper imports `src/bootstrap.ts`,
  which landed in the next commit). HEAD is fine. Verify at HEAD, not per-commit.

## Needs the owner

- **Chrome extension localhost access** — blocks all browser verification.
- **Real SMS provider** (MSG91 / Twilio / Gupshup): costs money, so it is your call and needs
  its own ADR. Indian transactional SMS requires **DLT-registered templates with fixed
  variable slots**, so the current free-form bodies must be restructured first.
- **Remove the dev OTP echo before any real deployment** (ADR-0016's mandatory revisit
  trigger). It is double-gated (`OTP_DEV_LOG=true` AND `NODE_ENV !== 'production'`) and
  currently **enabled in your local `.env`**, but it is an auth bypass living in a production
  code path.
- **`Notification` has no `societyId`**, against CLAUDE.md's tenancy rule; it is scoped
  transitively via `residentId`. Denormalising later means a migration plus a backfill.
- **Dev DB migration history:** `_prisma_migrations` still holds a rolled-back FEAT-004 row
  with a stale checksum, so `prisma migrate dev` demands a full reset. Use
  `migrate diff` + `migrate deploy`. `.claude/settings.json` now allows those two commands
  plus `prisma generate` and `seed`, at your request.

## Open P2 follow-ups (triage as CHOREs)

- **The rating UI has never been used by a human** — highest-value follow-up after the
  browser pass.
- A lint rule or shared `useMutationState` wrapper so the next control cannot be written
  without a paused state (BUG-004's own recommendation).
- `VendorsService.list` loads every Rating row to compute averages (ADR-0017 revisit trigger).
- `dispatch()` is a sequential per-recipient loop; `queue.addBulk` would make a
  200-participant fan-out one round-trip.
- `clamp()` truncates SMS bodies from the END, so a pathological name could cut the rupee
  amount off a money message.
- Admin failure copy is not offline-aware and has no stale-vs-empty axis, although
  `QueryErrorState` exists for exactly that.
- No in-app nudge to rate: a resident who never opens My Requests never rates, and the
  delivered SMS is the only prompt (ADR-0018 revisit trigger).
- Earlier items unchanged: FEAT-005's six, FEAT-004's three, FEAT-003's five, FEAT-001's three.

## Blockers

- None in code. Docker infra (Postgres 5442 / Redis 6399) is up. Seed:
  `pnpm --filter backend seed`.

## Next safe action

**A browser pass**, once the extension can reach localhost: onboard a resident (the OTP
arrives in a toast), join a round, then as super-admin close → assign → deliver it, and rate
it back on My Requests. That exercises every feature built this session and is the one form
of verification none of it has had.

After that, the first real society is a product decision, not an engineering one: the
remaining blockers are the SMS provider and removing the dev OTP echo.
