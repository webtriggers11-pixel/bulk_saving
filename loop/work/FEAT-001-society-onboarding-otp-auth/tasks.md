# Tasks FEAT-001 — Society onboarding + phone-OTP auth

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-001): ...`) AND append a LOG.md entry.

## Backend
- [ ] T1: Prisma model — add `Society`, `Resident`, `Role` enum; remove `HealthPing`; migration applies clean. Update `/health` to not depend on HealthPing. — depends: —
- [ ] T2: `packages/shared` — add auth DTO types, `Role`, `ResidentDto`, consumed by backend. — depends: T1
- [ ] T3: `notifications` module — `NotificationChannel` interface + stub SMS adapter (logs OTP in dev) + BullMQ-friendly wiring (OTP send may be sync). Unit test the stub. — depends: —
- [ ] T4: `OtpService` — generate/store/verify OTP in Redis with TTL, attempt cap, resend rate-limit (atomic counters). Unit tests: happy path, wrong code, lock after N, expiry, rate-limit. — depends: T3
- [ ] T5: `AuthService` + JWT — access + rotating refresh (Redis-tracked), issue/verify, revocation of reused refresh. Unit tests incl. reused-refresh rejection. — depends: T1, T4
- [ ] T6: Auth endpoints — `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `GET /me`; DTO + class-validator; standard envelope; `societyId` bound from invite code / token only. Integration tests (supertest) for the OTP happy path + invalid invite code. — depends: T5
- [ ] T7: Guards + roles — access-token guard populating tenant context; `@Roles()` + roles guard; `GET /admin/ping` restricted. Integration tests: 403 for resident, 200 for super-admin. — depends: T6
- [ ] T8: **Tenant isolation** integration test — resident in Society A cannot read Society B's data. — depends: T7
- [ ] T9: Seed script — insert societies (+ invite codes) + a SUPER_ADMIN resident by phone; documented run command. — depends: T1

## Frontend (React PWA)
- [ ] T10: Auth store (Zustand) + API client with refresh interceptor + token persistence. — depends: T6
- [ ] T11: Onboarding flow UI — step 1 invite code, step 2 phone, step 3 OTP entry → logged-in state; TanStack Query mutations; shadcn/ui; mobile-first. — depends: T10
- [ ] T12: Authenticated landing (shows resident + society) + logout; route guard for authed vs anon. — depends: T11
- [ ] T13: Frontend tests (Vitest + RTL) — onboarding flow renders + submits (mocked API), auth store transitions. — depends: T11

## Close
- [ ] T14: V2 independent review (code-reviewer runs verify.sh itself + audits vs spec/ARCHITECTURE). — depends: T1–T13
- [ ] T15: V3 fresh double-run of verify.sh; log both; then close (REGISTRY → done, commit). — depends: T14
