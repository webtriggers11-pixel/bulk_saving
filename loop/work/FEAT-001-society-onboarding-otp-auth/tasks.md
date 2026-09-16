# Tasks FEAT-001 — Society onboarding + phone-OTP auth

Dependency-ordered. Check a box only when `bash scripts/verify.sh` passes.
After each checked task: commit (`feat(FEAT-001): ...`) AND append a LOG.md entry.

## Backend — DONE (commit 32db18c; verify.sh exit 0, 27 backend tests; V2 reviewed + hardened)
- [x] T1: Prisma model — Society, Resident, Role enum; HealthPing removed; migration 20260916081001 clean; /health independent.
- [x] T2: `packages/shared` — auth DTO types, Role, ResidentDto/SocietyDto/MeResponse, consumed by backend.
- [x] T3: `notifications` module — NotificationChannel + stub SMS adapter (redacted; code only behind DEV flag). Unit tested.
- [x] T4: `OtpService` — 6-digit OTP, HMAC-hashed in Redis, 5-min TTL, atomic Lua verify-attempt cap + resend rate-limit. Unit tests: happy/wrong/lock/expiry/rate-limit.
- [x] T5: `AuthService` + JWT — access + rotating refresh (atomic Lua CAS), HS256 pinned, reuse → TOKEN_REVOKED. Unit tested incl. reuse rejection.
- [x] T6: Auth endpoints — /auth/otp/request|verify|refresh, /me; DTO + class-validator; envelope; societyId from invite/token only. Integration tests.
- [x] T7: Guards + roles — access-token guard + tenant context; @Roles + roles guard; /admin/ping restricted. Integration: 403 resident / 200 admin / 401 none.
- [x] T8: Tenant-isolation integration test — resident in Society A denied Society B's record (record proven to exist → 404 via scoping).
- [x] T9: Seed script — societies + SUPER_ADMIN by phone; `pnpm --filter backend seed` (tsc-compiled, Node-portable).
- [x] SEC (V2): removed hardcoded fallback secrets; fail-fast env validation (class-validator, secrets ≥16 chars); atomic Redis Lua; HS256 pin.

## Frontend (React PWA)
- [ ] T10: Auth store (Zustand) + API client with refresh interceptor + token persistence. — depends: T6
- [ ] T11: Onboarding flow UI — step 1 invite code, step 2 phone, step 3 OTP entry → logged-in state; TanStack Query mutations; shadcn/ui; mobile-first. — depends: T10
- [ ] T12: Authenticated landing (shows resident + society) + logout; route guard for authed vs anon. — depends: T11
- [ ] T13: Frontend tests (Vitest + RTL) — onboarding flow renders + submits (mocked API), auth store transitions. — depends: T11

## Close
- [ ] T14: V2 independent review (code-reviewer runs verify.sh itself + audits vs spec/ARCHITECTURE). — depends: T1–T13
- [ ] T15: V3 fresh double-run of verify.sh; log both; then close (REGISTRY → done, commit). — depends: T14
