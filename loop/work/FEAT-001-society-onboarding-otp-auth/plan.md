# Plan FEAT-001 — Society onboarding + phone-OTP auth

**Derived from:** spec.md · **Approved by:** <pending human> on <date>

## Technical approach

Backend (NestJS): a new `auth` module + `societies`/`residents` modules and a
`notifications` module (stub SMS adapter). Prisma domain model replaces `HealthPing`.
OTP + rate-limit + refresh state in Redis (ADR-0007). Tenant scoping via `societyId`
carried in the JWT and enforced in guards/services (ADR-0003). Frontend (React PWA):
a 3-step onboarding flow using TanStack Query mutations + a Zustand auth store, with
tokens persisted and a refresh interceptor.

## Data model / contracts

**Prisma models** (replaces HealthPing; one migration):
- `Society { id, name, city, inviteCode @unique, createdAt, updatedAt }`
- `Resident { id, societyId FK, phone, name?, role RESIDENT|SUPER_ADMIN, verifiedAt?, createdAt, updatedAt, @@unique([societyId, phone]) }`
- `Role` enum.

**Redis keys:** `otp:{societyId}:{phone}` (hash: code hash, attempts, expiry TTL) ·
`otp:resend:{phone}` (rate-limit counters) · `refresh:{residentId}` (current refresh id).

**Endpoints** (all standard envelope + DTO validation):
- `POST /auth/otp/request` { inviteCode, phone } → 200 { requested: true } (never the OTP)
- `POST /auth/otp/verify` { inviteCode, phone, code, name? } → 200 { accessToken, refreshToken, resident }
- `POST /auth/refresh` { refreshToken } → 200 { accessToken, refreshToken } (rotates)
- `GET /me` (auth) → resident profile
- `GET /admin/ping` (auth + @Roles(SUPER_ADMIN)) → role-guard demo/test endpoint

**Seed script:** inserts 1–2 societies (with invite codes) + a SUPER_ADMIN resident by phone.

**Shared types** (`packages/shared`): auth request/response DTO types, `Role`, `ResidentDto`.

## New decisions required

- **ADR-0007** (phone-OTP + JWT rotating refresh, OTP in Redis) — written, Accepted.
- ADR-0003 (shared-schema multi-tenancy) — already applies.
- No further ADRs anticipated; the real SMS provider gets its own ADR at pre-launch (out of scope here).

## Risks

- **Refresh-rotation race:** concurrent refreshes could both rotate — mitigate with a single
  atomic Redis check-and-set on the stored refresh id; test it.
- **OTP brute force:** enforced attempt cap + resend limits via atomic Redis counters; test the lock path.
- **Tenant leak:** the highest-risk correctness concern — `societyId` only ever from the token;
  a dedicated cross-tenant isolation integration test is mandatory (acceptance criterion).
- **Frontend token storage:** store tokens carefully (in-memory + refresh flow); keep it simple for v1 PWA.
- Removing `HealthPing` changes the health check that touched it — keep `/health` DB-agnostic or point it at a trivial query.
