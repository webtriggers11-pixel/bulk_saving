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

## Frontend (React PWA) — DONE (commit 32db18c range; verify.sh exit 0, 13 web tests; V2 APPROVE)
- [x] T10: Auth store (Zustand, persisted) + API client with single-flight refresh + retry + token persistence (safeStorage try/catch).
- [x] T11: Onboarding wizard — invite code → phone → 6-digit OTP (+ resend, optional name) → logged-in; TanStack Query mutations; friendly error-code messages; mobile-first; hand-rolled shadcn-style primitives (ADR-0008).
- [x] T12: react-router-dom; ProtectedRoute/AnonymousRoute guards; authed landing shows resident + society from GET /me (TanStack Query); logout.
- [x] T13: Vitest + RTL — onboarding flow (mocked API) + error render, auth store transitions, refresh single-flight/failure, ProtectedRoute redirect. 13 web tests.

## Close — DONE
- [x] T14: V2 independent review — backend (CHANGES REQUESTED → fixed) + frontend (APPROVE). Reviewer ran verify.sh itself both times.
- [x] T15: V3 fresh double-run of verify.sh by closer — both exit 0, identical (web 13/6, backend 27/9), not flaky. Docs drift (shadcn) fixed via ADR-0008.

## Known P2 follow-ups (non-blocking, from V2 — triage later)
- Vestigial `society` field in auth store (set null on login, unused for display).
- No direct component test for HomePage (/me render) or AnonymousRoute redirect.
- Leftover CHORE-001 demo files (src/api/health.ts, src/store/ui.store.ts) outside feature layout.
