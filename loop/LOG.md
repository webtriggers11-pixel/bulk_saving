# PROJECT LOG — append-only journal

> The permanent record. Skills append entries automatically at every
> meaningful event: work item opened/closed, task completed, decision made,
> session ended. NEVER edit or delete past entries — append only.
> HANDOFF.md says "where are we now"; this file says "how did we get here".

Entry format (newest at the BOTTOM, so git diffs are clean):

```
## <date> <time> — <ID or "session"> — <event>
- What: <one line>
- Evidence: <test output count / manual check / n/a>
- Decisions: <ADR-NNNN or none>
- By: <agent | human-approved>
```

---

## 2026-07-03 — session — boilerplate initialized
- What: loop-boilerplate created; awaiting bootstrap
- Evidence: n/a
- Decisions: ADR-0001 (record decisions)
- By: human-approved

## 2026-09-16 — session — product brainstorm + architecture (pre-Loop, vibe skills)
- What: Bulk Saving (group-buy home services for societies) brainstormed → BRIEF.md; architecture designed → ARCHITECTURE.md; spec-review passed (0 P0/P1). Kept as reference docs at root.
- Evidence: spec-review 0 P0 / 0 P1 (vibe/spec-reviews/2026-09-16-brainstorm.md)
- Decisions: none yet formalized as ADRs at this point
- By: human-approved

## 2026-09-16 — bootstrap — stack contract filled (docs only, no deps)
- What: STACK.md + CLAUDE.md stack sections filled (React PWA + NestJS + Postgres + Redis + Prisma, pnpm monorepo). ARCHITECTURE.md decisions folded into ADR-0002..0005.
- Evidence: n/a (documentation only — no code, no dependencies installed)
- Decisions: ADR-0002 (monorepo/stack), ADR-0003 (shared-schema multi-tenancy), ADR-0004 (Postgres-authoritative round concurrency), ADR-0005 (Prisma over TypeORM)
- By: human-approved

## 2026-09-16 — triage — work map registered
- What: Registered CHORE-001 + FEAT-001..008 in REGISTRY.md with dependency-ordered build plan. Opened CHORE-001 (monorepo scaffold) with spec/plan/tasks.
- Evidence: n/a
- Decisions: none
- By: agent

## 2026-09-16 — CHORE-001 — opened, awaiting approval to execute
- What: CHORE-001 scaffold spec/plan/tasks written. BLOCKED: execution installs dependencies → needs human approval (CLAUDE.md "Ask the human before adding any dependency"). verify.sh still unconfigured until scaffold runs.
- Evidence: n/a
- Decisions: ADR-0002, ADR-0005
- By: agent

## 2026-09-16 — CHORE-001 — approved + executed (scaffold built)
- What: Human approved dependency install + Docker Compose (ADR-0006) + pnpm. Monorepo scaffolded (apps/backend NestJS+Prisma+BullMQ, apps/web React PWA + TanStack Query + Zustand, packages/shared). Dev DB/Redis via Docker Compose; host ports remapped to 5442/6399 (5432/6379 occupied). verify.sh wired: build shared → prisma generate → lint → typecheck → test.
- Evidence: prisma migrate dev --name init clean (HealthPing created); verify.sh exit 0.
- Decisions: ADR-0002, ADR-0005, ADR-0006
- By: human-approved (build via subagent)

## 2026-09-16 — CHORE-001 — V2 independent review
- What: Independent reviewer ran verify.sh itself + audited scaffold vs spec + ARCHITECTURE. Verdict APPROVE after 3 minor fixes: F1 PWA icons (192/512 + maskable) so app is installable, F2 counter test now actually clicks, F3 web typecheck added to verify.sh. No P0.
- Evidence: reviewer verify.sh exit 0 (backend 5/5, web 3/3); grep found zero `any`/`@ts-ignore`/`eslint-disable`; BullMQ test confirmed real (not mocked).
- Decisions: none
- By: agent (independent reviewer subagent)

## 2026-09-16 — CHORE-001 — CLOSED (V3 + commit)
- What: Closer ran verify.sh 3× back-to-back — all exit 0, identical (backend 5 tests/3 suites, web 3 tests) → not flaky. git repo initialized; scaffold committed. REGISTRY → done.
- Evidence: verify.sh exit 0 ×3 (RUN1_EXIT=0, RUN2 identical, third run exit 0). Commit efd1526.
- Decisions: ADR-0002, ADR-0005, ADR-0006
- By: human-approved

## 2026-09-16 — FEAT-001 — opened, spec drafted (awaiting approval)
- What: Created loop/work/FEAT-001-society-onboarding-otp-auth/ with spec.md (Society+Resident model, invite-code + phone-OTP onboarding, JWT access+refresh, roles, tenant isolation). 6 open questions pending human answers. No code until spec/plan approved (Loop rule 2).
- Evidence: n/a (spec only)
- Decisions: ADR-0003 (applies); JWT-auth + OTP-storage ADRs to be written at plan time
- By: agent

## 2026-09-16 — FEAT-001 — open questions resolved; plan + tasks drafted
- What: Human resolved all 6 open questions (full-stack scope, stub SMS adapter, seed-script super-admin, default OTP policy). Wrote ADR-0007 (phone-OTP + JWT rotating refresh, OTP in Redis), plan.md, and tasks.md (15 tasks: backend T1–T9, frontend T10–T13, V2/V3 close). Status → planned. Awaiting plan approval before code (Loop rule 2).
- Evidence: n/a (plan only)
- Decisions: ADR-0007
- By: agent (pending human plan approval)

## 2026-09-16 — FEAT-001 — plan approved; backend build started (T1–T9)
- What: Human approved the plan (execute backend-first, then PWA) and approved the one new dependency `@nestjs/jwt`. Status → in-progress. Building T1–T9 (Prisma model, shared types, notifications stub, OtpService, AuthService+JWT, endpoints, guards/roles, tenant-isolation test, seed script).
- Evidence: pending (verify.sh at task completion)
- Decisions: ADR-0003, ADR-0007; dependency @nestjs/jwt approved
- By: human-approved

## 2026-09-16 — FEAT-001 — backend T1–T9 built (pre-review)
- What: Backend implemented: Society/Resident model (+migration, HealthPing removed), notifications stub, OtpService (Redis, hashed OTP, attempt/rate limits), AuthService+JWT rotating refresh, auth endpoints, role guards, GET /residents/:id (society-scoped), tenant-isolation test, seed script. Dep @nestjs/jwt@^11 (pinned CommonJS).
- Evidence: verify.sh exit 0 (backend 27 tests/9 suites, web 3) per builder.
- Decisions: ADR-0003, ADR-0007
- By: agent (build subagent)

## 2026-09-16 — FEAT-001 — V2 independent review: CHANGES REQUESTED
- What: Independent reviewer ran verify.sh itself (27/27 backend, 3/3 web, exit 0 ×2) and audited auth+tenancy. All acceptance criteria MET; tenant isolation verified genuinely enforced; tests real (HTTP + real DB/Redis, OTP never leaked). No active auth-bypass/tenant-leak. Findings: P1 hardcoded fallback secrets + no env validation (missing from .env.example); P2s: non-atomic OTP verify counter, INCR/EXPIRE split, JWT alg not pinned, seed Node-20 portability.
- Evidence: reviewer verify.sh exit 0 ×2; grep clean (no any/ts-ignore/console); Lua atomic refresh confirmed.
- Decisions: none (fixes tracked under ADR-0007 hardening)
- By: agent (independent reviewer subagent)

## 2026-09-16 — FEAT-001 — applying V2 fixes (P1 + security P2s)
- What: Sent fixes to builder: remove hardcoded secret fallbacks + add fail-fast env validation via class-validator (no new dep) + add secret keys to .env/.env.example; make OTP verify-attempt + hourly-resend counters atomic (Lua); pin JWT alg HS256; fix seed Node portability. Re-verify to follow.
- Evidence: pending re-verify
- Decisions: none
- By: human-approved (fixes directed by reviewer findings)

## 2026-09-16 — FEAT-001 — backend hardening verified; T1–T9 CHECKPOINT (committed)
- What: Closer independently re-ran verify.sh (exit 0; backend 27/27, web 3/3) and read the security fixes: env.validation.ts (fail-fast, secrets ≥16), auth.service HS256 + throwing secret getters (grep confirms no fallback), otp.service atomic VERIFY_LUA + RESEND_HOURLY_LUA. .env gitignored; .env.example placeholders only. Backend (T1–T9) committed 32db18c. Feature remains in-progress (PWA T10–T13 + V3 close pending). Backend checkpoint passed → awaiting go for PWA chunk.
- Evidence: verify.sh exit 0 (27 backend / 3 web); fail-fast boot confirmed by reviewer (missing secret → BOOT_EXIT=1); commit 32db18c.
- Decisions: ADR-0003, ADR-0007
- By: human-approved

## 2026-09-16 — FEAT-001 — PWA chunk started (T10–T13); dep react-router-dom approved
- What: Human approved proceeding to the PWA onboarding UI and adding react-router-dom. Building: Zustand auth store + API client with refresh interceptor + token persistence, 3-step onboarding (invite→phone→OTP→logged-in), authed landing + logout, route guards, Vitest/RTL tests.
- Evidence: pending (verify.sh at completion)
- Decisions: dependency react-router-dom approved
- By: human-approved

## 2026-09-16 — FEAT-001 — PWA T10–T13 built
- What: React PWA onboarding: Zustand auth store (persisted), api client with single-flight refresh+retry, 3-step wizard (invite→phone→OTP), react-router-dom guards, authed landing from /me, logout, Vitest/RTL tests. Only new dep react-router-dom. Discovered shadcn/ui was never installed by scaffold → hand-rolled shadcn-style primitives (no new deps).
- Evidence: verify.sh exit 0 (web 13 tests/6 files, backend 27) per builder; web PWA build intact.
- Decisions: react-router-dom
- By: agent (build subagent)

## 2026-09-16 — FEAT-001 — frontend V2 review: APPROVE
- What: Independent reviewer ran verify.sh itself ×2 (exit 0, web 13/6 + backend 27/9) + PWA build. Refresh single-flight/no-loop verified, route guards correct, server state via TanStack Query (not duplicated in store), API contract matches backend exactly, tests real. No P0/P1. P2 notes: shadcn doc-drift, vestigial society field, missing HomePage/AnonymousRoute tests, leftover demo files.
- Evidence: reviewer verify.sh exit 0 ×2; grep clean (no any/ts-ignore); only react-router-dom added.
- Decisions: none
- By: agent (independent reviewer subagent)

## 2026-09-16 — FEAT-001 — CLOSED (V3 + doc fix + commit)
- What: Fixed shadcn doc-drift honestly — ADR-0008 (hand-rolled shadcn-style primitives) + corrected STACK.md/ARCHITECTURE.md/CLAUDE.md. Closer ran V3: verify.sh ×2 back-to-back, both exit 0, identical (web 13/6, backend 27/9) → not flaky. REGISTRY → done. 3 P2 follow-ups recorded in tasks.md for later triage.
- Evidence: V3 verify.sh RUN1_EXIT=0, RUN2_EXIT=0 identical.
- Decisions: ADR-0008
- By: human-approved

## 2026-09-16 — FEAT-002 — opened, spec drafted (awaiting approval)
- What: Created loop/work/FEAT-002-service-catalog/ with spec.md (Service master + per-society ServiceOffering, resident GET /catalog scoped by society, super-admin catalog API, resident catalog screen, seed). 3 open questions (visibility model, admin-UI scope, categories) pending. No code until spec/plan approved (rule 2).
- Evidence: n/a (spec only)
- Decisions: ADR-0003 (applies)
- By: agent

## 2026-09-16 — FEAT-002 — open questions resolved; plan + tasks drafted
- What: Human resolved: per-society ServiceOffering (ADR-0009), admin API+seed now (UI in FEAT-005), free-text categories. Wrote ADR-0009, plan.md, tasks.md (T1–T6 backend, T7–T9 frontend, T10–T11 close). Status → planned. Awaiting plan approval before code (rule 2).
- Evidence: n/a (plan only)
- Decisions: ADR-0009
- By: agent (pending human plan approval)

## 2026-09-16 — FEAT-002 — plan approved; full build started (T1–T9)
- What: Human approved the plan (build all in one chunk). Status → in-progress. Building catalog model + resident GET /catalog + super-admin catalog API + seed + resident catalog screen + tests. No new deps.
- Evidence: pending (verify.sh at completion)
- Decisions: ADR-0003, ADR-0009
- By: human-approved

## 2026-09-16 — FEAT-002 — T1–T9 built
- What: Catalog model (Service + ServiceOffering), society-scoped GET /catalog (single joined query), super-admin catalog API (services + offerings), seed +5 services enabled for both societies, resident /services screen (cards + empty/error/loading). No new deps.
- Evidence: verify.sh exit 0 (backend 38/11, web 16/7) per builder; seed idempotent; web PWA build ok.
- Decisions: ADR-0003, ADR-0009
- By: agent (build subagent)

## 2026-09-16 — FEAT-002 — V2 independent review: APPROVE
- What: Reviewer ran verify.sh itself ×2 (exit 0, backend 38/38, web 16/16, identical) + web build + seed idempotency (2×, no dupes). Tenant isolation verified genuine (B-only offering absent from A's /catalog; societyId only from verified JWT; single joined query, no N+1). All /admin/* class-guarded @Roles(SUPER_ADMIN), resident→403, slug→409, unknown→404. No P0/P1. P2: missing 403 assertion on PATCH + 404-path assertions (code correct, tests absent) → being added before close.
- Evidence: reviewer verify.sh exit 0 ×2; grep clean; no new dep.
- Decisions: none
- By: agent (independent reviewer subagent)

## 2026-09-16 — FEAT-002 — CLOSED (V3 + commit)
- What: Added 2 P2 test-coverage items (PATCH 403 + 404 not-found paths → backend 41 tests). Closer ran V3: verify.sh ×2 back-to-back, both exit 0, identical (backend 41, web 16) → not flaky. REGISTRY → done.
- Evidence: V3 RUN1=0, RUN2=0 identical.
- Decisions: ADR-0003, ADR-0009
- By: agent (autonomous — per owner directive to run the loop without per-step approval)

## 2026-09-16 — FEAT-003 — opened + planned (autonomous); backend build started
- What: Core group-buy rounds. Wrote spec (decisions baked in), ADR-0010 (admin-opened rounds, units-join, one-open-per-service), plan, tasks (T1–T12). Building backend chunk T1–T7 (Round/RoundTier/RoundParticipant model, admin open/close, GET /rounds with tier calc, atomic join/update/leave per ADR-0004, concurrency test, seed). Status → in-progress. No user approval gate (owner directive).
- Evidence: pending (verify.sh)
- Decisions: ADR-0003, ADR-0004, ADR-0010
- By: agent (autonomous)

## 2026-09-16 — FEAT-003 — backend T1–T7 built
- What: rounds module — Round/RoundTier/RoundParticipant, partial-unique (one OPEN per society+service), admin open/close, GET /rounds (tier calc), atomic units join/update/leave (relative increment in tx), demo seed round. Backend 69 tests (+28); concurrency test 20 distinct residents → exact 210.
- Evidence: verify.sh exit 0 ×2 per builder.
- Decisions: ADR-0004, ADR-0010
- By: agent (build subagent)

## 2026-09-17 — FEAT-003 — V2 review: CHANGES REQUESTED (concurrency defect)
- What: Reviewer ran verify.sh ×2 (exit 0, backend 69, web 16). Multi-resident concurrency proven correct; tier math + tenant isolation + admin protection all correct. BUT P1: same-resident concurrent mutations drift unitsCount from sum(participant.units) — delta computed from an UNLOCKED participant read (no SELECT FOR UPDATE) → oversell risk. P2: increment not status-guarded (post-close join window) + close() not transactional; concurrency test gap (no same-resident case); no upper bound on units. Sending row-lock fix.
- Evidence: reviewer analysis rounds.service.ts:60-194; test gap identified.
- Decisions: none (fixes apply ADR-0004 canonical pattern more strictly)
- By: agent (independent reviewer subagent)

## 2026-09-17 — FEAT-003 — backend concurrency fixes verified + committed (T1–T7 checkpoint)
- What: Row lock (SELECT ... FOR UPDATE) added to every mutating round tx; status-guarded increment (where id+OPEN); close() serialized; units @Max(50); +2 same-resident concurrency tests. Closer independently re-ran verify.sh (exit 0, backend 71/web 16) and read the lock code (lockOpenRoundForWrite called first in join/update/leave). Backend chunk committed 3aca323. Feature stays in-progress (PWA T8–T10 + V3 pending).
- Evidence: verify.sh exit 0; grep confirms FOR UPDATE lock + status:'OPEN' guard + @Max(50). Commit 3aca323.
- Decisions: ADR-0004 (canonical pattern enforced)
- By: agent (autonomous)

## 2026-09-17 — FEAT-003 — PWA T8–T10 built + V2 APPROVE
- What: /rounds screen (cards: progress, current price, unlocks-hint, deadline countdown, join/update/leave, units 1–50), TanStack Query hooks with 20s polling + invalidation. web 25 tests (+9). V2 frontend review APPROVE (no P0/P1; 4 cosmetic/coverage P2s logged as follow-ups). No new deps.
- Evidence: reviewer verify.sh exit 0 ×2 (backend 71, web 25); PWA build ok; contract matches backend.
- Decisions: none
- By: agent (build + independent reviewer subagents)

## 2026-09-17 — FEAT-003 — CLOSED (V3 + commit)
- What: Closer ran V3 double-run: verify.sh ×2, both exit 0, identical (backend 71, web 25) → not flaky. REGISTRY → done. Core group-buy mechanic complete (admin-opened rounds, atomic units-join, tiered pricing, resident /rounds screen). 5 P2 follow-ups recorded in tasks.md.
- Evidence: V3 RUN1=0, RUN2=0 identical.
- Decisions: ADR-0003, ADR-0004, ADR-0010
- By: agent (autonomous)

## 2026-09-17 — FEAT-004 — opened + planned (autonomous); backend build started
- What: Round lifecycle state machine + scheduled closing. Wrote spec, ADR-0011 (full status set, "met"=units>=lowest tier, BullMQ delayed-job scheduler, guarded transition() in RoundsService), plan, tasks (T1–T7). Building T1–T5: enum extend + migration, transition guard matrix, close-met/expired + cancel, BullMQ round-closing queue + processor + enqueue-on-create, scheduler + join-rejection tests. Backend-only. Status → in-progress.
- Evidence: pending (verify.sh)
- Decisions: ADR-0004, ADR-0011
- By: agent (autonomous)

## 2026-09-17 — FEAT-004 — T1–T5 built (resumed interrupted session)
- What: Resumed a partly built, uncommitted T1–T5. Already there: enum + migration (applied), rounds.transitions map, guarded transition() / closeRound (met vs expired) / cancel, POST /admin/rounds/:id/cancel, round-closing queue + RoundClosingScheduler + RoundCloserProcessor, enqueue on create and job removal on close/cancel. Added this session: markAssigned/markDelivered/markRated service methods, a full 49-pair transition unit matrix, admin integration tests (job enqueued at deadline, close → CLOSED_EXPIRED / CLOSED_MET, idempotent re-close, cancel + job removal, cancel from terminal → 409, 403/404), and a new round-lifecycle integration suite (processor met/expired/idempotent/missing/double-fire, real BullMQ delayed job auto-close, cancelled job never fires, join/update/leave on CLOSED_MET/EXPIRED/CANCELLED → ROUND_CLOSED, ASSIGNED→DELIVERED→RATED + illegal → 409, GET /rounds OPEN-only). Fixed the stale 'CLOSED' assertion. No new deps.
- Evidence: verify.sh exit 0 — backend 145 tests / 16 suites, web 25 / 9 files.
- Decisions: ADR-0004, ADR-0011
- By: agent (autonomous)

## 2026-09-17 — FEAT-004 — V2 independent review: CHANGES REQUESTED → fixes applied
- What: Reviewer ran verify.sh ×2 (exit 0 both, backend 145 / web 25, identical; no leaked Redis jobs or DB rows). Transition map, row locking, migration and web confirmed correct. P1-1: a Redis enqueue failure after round create left an OPEN round with no job (500 and then 409 on retry, no auto-close). P1-2: close jobs had no retries, so one transient DB error stranded a round OPEN. Fixes: create + enqueue now run in one transaction (a failed enqueue rolls the round back); jobs get 6 attempts with exponential backoff; schedule() replaces a leftover failed/completed job; new RoundClosingReconciler re-ensures jobs for every OPEN round on boot (covers the seeded round, lost Redis state and the rare commit race; skipped under Jest, which calls reconcile() scoped). P2 fixes: typed processor result, deterministic cancelled-job assertion, listener cleanup, corrected scheduler comment. Deferred P2: tests share the dev DB/Redis (predates FEAT-004); moving a pending job on a deadline edit needs cancel() then schedule() (no edit path yet). +3 tests.
- Evidence: verify.sh exit 0 — backend 148 / 16 suites, web 25.
- Decisions: ADR-0011 (its revisit-trigger safety net is now implemented as a boot reconciler, not a periodic sweep)
- By: agent (independent reviewer subagent + implementer)

## 2026-09-17 — FEAT-004 — V2 re-review: APPROVE; last P2s fixed
- What: Reviewer re-ran verify.sh (exit 0, backend 148 / web 25, no leaks) and confirmed both P1s fixed, with no new blocking issues. Two P2s fixed right away: the processor now throws on a missing round so backoff retries cover a job that fires before its round is committed (no-op on the final attempt); test/load-env pins NODE_ENV=test so the boot reconciler never runs across the shared test DB. Remaining P2 follow-ups recorded in tasks.md.
- Evidence: verify.sh exit 0 (backend 148, web 25). Commit aece98d.
- Decisions: ADR-0011 (addendum)
- By: agent (independent reviewer subagent + implementer)

## 2026-09-17 — FEAT-004 — CLOSED (V3 + commit)
- What: V3 double run: verify.sh ×2 back-to-back, both exit 0, identical (backend 148 tests / 16 suites, web 25 / 9 files), so not flaky. REGISTRY → done. The full round lifecycle state machine, BullMQ deadline auto-close (atomic, idempotent, retried, reconciled at boot) and the admin cancel endpoint are complete.
- Evidence: V3 RUN1=0, RUN2=0 identical.
- Decisions: ADR-0004, ADR-0011
- By: agent (autonomous)

## 2026-09-17 — FEAT-005 — opened + planned (autonomous)
- What: Super-admin dashboard. Wrote spec, ADR-0012 (global Vendor list; vendorId/finalPrice/assignedAt/deliveredAt on Round; per-participant paymentCollectedAt manual flag; assign/deliver data written inside the guarded transition), plan, tasks T1–T14. The approach freezes the shared DTO contract first (T2), then builds backend (T1, T3–T7) and frontend (T8–T12) in parallel. Status → in-progress. No new deps planned.
- Evidence: pending (verify.sh)
- Decisions: ADR-0003, ADR-0011, ADR-0012
- By: agent (autonomous)

## 2026-09-17 — FEAT-005 — backend + frontend built (parallel); checkpoint commit, verify RED (triaged)
- What: Backend builder: migration 20260917120000_feat_005_admin_dashboard (Vendor; Round vendorId/finalPrice/assignedAt/deliveredAt + status index; RoundParticipant paymentCollectedAt). `prisma migrate dev` wanted to RESET the shared dev DB (the FEAT-004 row in _prisma_migrations has a checksum mismatch from an earlier rolled-back attempt), so no reset was done: the SQL was produced with `migrate diff` and applied with `migrate deploy`, with no drift afterwards. Vendors CRUD, GET /admin/societies, /admin/rounds list + detail, /admin/dashboard, assign/deliver via transition(prepareData) (legality is checked before vendor checks, and a rejected assign writes nothing), payment PUT. 48 new backend tests. Frontend builder: features/admin (api, hooks, AdminRoute, AdminLayout, Dashboard, RoundDetail, Vendors, NewRound pages), Badge/Select primitives, home admin link, 25 new web tests; PWA build OK. No new deps.
- Evidence: my own verify.sh exit 1. Lint + typecheck pass everywhere; the failures are all timing under CPU load (load avg 60–90, partly from unrelated processes on the machine): 10 web tests hit the 5s timeout or the 1s waitFor, including older App/Onboarding/RoundsPage tests; backend join transactions exceed Prisma's 5s interactive-transaction timeout while queued on the round row lock (500). Both triaged as bugs (BUG-001, BUG-002). Tasks stay unchecked until verify is green.
- Decisions: ADR-0012
- By: agent (build subagents + orchestrator)

## 2026-09-17 — BUG-001 + BUG-002 — triaged, reproduced, fixed
- What: BUG-001 (P1): round mutation transactions returned 500 when queued more than 5s behind the row lock (Prisma's default 5s interactive-transaction timeout includes lock wait). Failing regression test first (holds the lock 6.5s; before the fix Expected 201, Received 500), then all round transactions go through inRoundTx() with {maxWait 5s, timeout 30s}; test green. The single-test repro and green check were run with jest -t, which is diagnostic only; full verification went through verify.sh. BUG-002 (P2): web tests timed out under CPU contention; verify.sh now runs workspace tests one at a time; vitest testTimeout/hookTimeout 20s; RTL asyncUtilTimeout 5s. The flakiness only shows under load (evidence is the FEAT-005 verify log).
- Evidence: verify.sh exit 0 at load avg ~60: backend 192 tests / 18 suites, web 50 / 16 files.
- Decisions: ADR-0004 (unchanged; implementation fix)
- By: agent (autonomous)

## 2026-09-17 — FEAT-005 — T1, T3–T12 verified
- What: With BUG-001/002 fixed, the FEAT-005 build passes verification. Tasks checked; V2 next.
- Evidence: verify.sh exit 0 (backend 192 / 18 suites, web 50 / 16 files).
- Decisions: ADR-0012
- By: agent (autonomous)

## 2026-09-17 — FEAT-005 + BUG-001 + BUG-002 — V2 APPROVE (backend + frontend), P2 fixes applied
- What: Two independent reviewers ran verify.sh themselves (exit 0, backend 192 / web 50; web build OK) and both APPROVED with P2s only. Backend confirmed: the single status write holds (status is spread last, rejected assigns write nothing); the payment flag is correct; the migration is additive and the migration files match the schema (checked on a temporary shadow DB); the FEAT-004 checksum row affects only this dev DB; the BUG-001 fix is complete and its test genuinely reproduces the bug. Fixed before close: vendor PATCH with null → 400 (was 500); cancel refused with 409 PAYMENTS_COLLECTED while payments are collected; vendor share-lock during assign; UI refetch after a failed action; vendor edits refresh rounds; Cancel disabled during assign. BUG-001 connection-pool trade-off recorded with a revisit trigger. The remaining P2s are in FEAT-005 tasks.md.
- Evidence: verify.sh exit 0 (backend 193 / 18 suites, web 50 / 16 files). Commit a3d66e8.
- Decisions: ADR-0012; ADR-0004 (unchanged)
- By: agent (independent reviewer subagents + implementer)

## 2026-09-17 — FEAT-005, BUG-001, BUG-002 — CLOSED (V3 + commit)
- What: V3 double run: verify.sh ×2 back-to-back, both exit 0, identical (backend 193 tests / 18 suites, web 50 / 16 files), so not flaky, and it ran with load average ~25–50 from unrelated processes, which confirms BUG-002 is fixed. REGISTRY → done for all three.
- Evidence: V3 RUN1=0, RUN2=0 identical.
- Decisions: ADR-0012
- By: agent (autonomous)
