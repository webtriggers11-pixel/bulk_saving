# Backend audit: RBAC, security and production readiness

- **Date:** 2026-10-19
- **Scope:** `apps/backend`. Covers auth and roles, tenant isolation, the rounds, catalog, vendors, residents and admin modules, notifications and queues, config, bootstrap, and `docker-compose.prod.yml`.
- **Method:** a read-only code review. The Critical and High findings were re-checked against the code; the others are line-level reads with file references. No code was changed.
- **Status:** none of these findings has been triaged yet. Each fix enters through the triage skill as a BUG or CHORE with an ID from `loop/REGISTRY.md`.

## Summary

The RBAC core is sound:
- Every admin controller uses `AccessTokenGuard`, `RolesGuard` and `@Roles(SUPER_ADMIN)`. A RESIDENT gets 403.
- Every resident path takes `societyId` from the JWT. No cross-society read or write (IDOR) was found.
- The unit count cannot drift: mutations take a row lock and use relative increments.
- Status changes all go through one guarded state machine.

The real risks are:
- deployment safety: the stub SMS channel, a fake health check, a missing `TRUST_PROXY`, and leaked error messages;
- the session model: refresh tokens never expire, there is no logout, and a reused token does not end the session;
- pledges accepted after the deadline;
- OTP abuse: lockouts against other users, and SMS cost.

Paths below are relative to `apps/backend/src/` unless stated.

## Critical / High: fix before production

| # | Sev | Issue | Where | Fix |
|---|---|---|---|---|
| 1 | **Critical** | **Real SMS isn't wired in.** The stub channel is always used and nothing stops it booting in production. No OTPs are delivered, so nobody can log in. Notification rows are still marked SENT. | `modules/notifications/notifications.module.ts:21` | Pick the channel from config. Refuse to boot when `NODE_ENV=production` and the stub is selected. |
| 2 | **High** | **Pledges are accepted after the deadline.** `lockOpenRoundForWrite` checks `status` only, never `deadline`. The round stays OPEN until the close job runs. That job gives up after about 60s, and the reconciler runs only at boot, so a short DB outage at the deadline leaves the round joinable until the next deploy. | `modules/rounds/rounds.service.ts:554`, `modules/rounds/round-closing.reconciler.ts:25` | Read `deadline` under the row lock and return 409 `ROUND_CLOSED` once it has passed. Run the reconciler as a repeating job. |
| 3 | **High** | **Refresh tokens never expire by default, and reuse does not revoke the session.** Whoever refreshes a stolen token first keeps the session indefinitely; the real user is the one logged out. | `modules/auth/auth.service.ts:81,192` | Set a finite refresh TTL. When an old token is reused, delete `refresh:<id>`, which ends the session. |
| 4 | **High** | **The exception filter sends raw error text to clients.** Prisma errors expose the schema and constraint names. Easy triggers: `PATCH /admin/services/:id {"name":null}`, a tier price above 2³¹, or two creates racing on the same slug. | `common/http-exception.filter.ts:49` | Return a generic message for 5xx and log the details on the server. Map P2002 to 409 and P2025 to 404. |
| 5 | **High** | **`TRUST_PROXY` isn't passed to the api container.** Behind the proxy, every client shares one IP, so the throttler and the per-client OTP limits apply to everyone together. `JWT_REFRESH_TTL_SECONDS` is missing there too. | `docker-compose.prod.yml:56-68` (repo root) | Add both variables to the api `environment` block. |
| 6 | **High** | **The health check verifies nothing.** It always returns `ok`, even when Postgres or Redis is down. | `health/health.service.ts` | Run `SELECT 1` and a Redis `PING`, and return 503 when either fails. |

## Medium

| # | Issue | Where | Fix |
|---|---|---|---|
| 7 | There is no logout endpoint. A session can only be revoked by deleting a Redis key by hand. | `modules/auth/auth.controller.ts` | Add `POST /auth/logout`, which deletes the refresh key. |
| 8 | Each resident has one refresh slot, so signing in on a second device logs out the first. | `modules/auth/auth.service.ts:94` | Store one refresh handle per device (key it by `jti`). |
| 9 | Phone-wide verify-fail and resend limits let anyone lock a victim, including the admin, out for an hour with about 20 wrong codes. | `modules/auth/otp.service.ts:36-38` | Make the per-client limits the main control. Make the phone-wide lockout softer, or apply it only after the per-client limits are exhausted. |
| 10 | SMS cost abuse: no per-IP cap across phone numbers. A leaked invite code allows texts to unlimited numbers, 10 per hour each. | `modules/auth/otp.service.ts:148` | Add a per-IP hourly cap on OTP requests across all numbers. |
| 11 | Phone numbers aren't normalized. `+91…`, `91…` and `98…` become separate residents, and the admin lookup can miss. | `modules/auth/auth.dto.ts:11` | Normalize to E.164 in the DTO before storing or looking up. |
| 12 | Notification and close recovery runs only at boot. Rows left PENDING more than 24h are never sent. | `modules/notifications/notification-dispatch.reconciler.ts:21` | Run the reconcile on a repeating BullMQ job. |
| 13 | Duplicate SMS can be sent if the provider succeeds and `markSent` then fails. That costs money with a paid provider. | `modules/notifications/notification-dispatch.processor.ts:62-79` | Mark the row as sending before calling the provider. Flag stale claims for review instead of resending. |
| 14 | A row can stay PENDING while its job sits in `failed`. The reconciler's `add()` with the same jobId then does nothing. *(plausible)* | `modules/notifications/notification-dispatch.reconciler.ts` | Remove or retry failed jobs before adding them again. |
| 15 | Redis has no password or TLS option and no `'error'` listener. Requests hang during an outage. | `redis/redis.service.ts:13`, `app.module.ts:33` | Add `REDIS_URL` with TLS, an error logger, and a low `maxRetriesPerRequest`. |
| 16 | The throttler counts in process memory, so the real limit is N× with N replicas and resets on restart. | `app.module.ts:31` | Use Redis-backed throttler storage. *(new dependency, needs approval)* |
| 17 | JWT secret rules are weak: 16 characters minimum, and the access and refresh secrets may be equal. If equal, a never-expiring refresh token also works as an access token. | `config/env.validation.ts:5` | Require at least 32 characters and different secrets in prod. Add a `typ` claim that verification checks. |
| 18 | `assign` accepts any `finalPrice`, even above the tier price residents were shown. | `modules/rounds/rounds.service.ts:337`, `modules/rounds/rounds.dto.ts:135` | Reject, or require confirmation, when it is above the current tier price. |
| 19 | Tier prices can rise as volume rises, e.g. 10 units at ₹500 and 20 units at ₹900. | `modules/rounds/rounds-admin.service.ts:298` | Require each tier's price to be at most the previous tier's. |
| 20 | `GET /residents/:id` returns a neighbour's phone number and role (same society only). | `modules/residents/residents.controller.ts:25` | Allow only your own id, or leave `phone` out for anyone else. |
| 21 | `/admin/dashboard` loads every participant on the platform on each request. | `modules/rounds/rounds-admin.service.ts:213` | Compute the sums in SQL. |
| 22 | `GET /admin/vendors` loads every rating on each request. | `modules/vendors/vendors.service.ts:41` | Group by vendor in the database (`AVG`/`COUNT`). |

## Low

| # | Issue | Where |
|---|---|---|
| 23 | Roles are trusted from the JWT, so a demoted admin or deleted resident keeps access for up to 15 minutes. | `modules/auth/auth.service.ts:148` |
| 24 | Access control fails open: there is no global guard, and `RolesGuard` allows any route with no `@Roles`. A future route that forgets the decorator would be unprotected. | `modules/auth/roles.guard.ts:17` |
| 25 | An admin's phone can sign in through the resident door and get SUPER_ADMIN tokens, which bypasses the admin door. | `modules/residents/residents.service.ts:14` |
| 26 | Invite-code lookups aren't rate limited. | `modules/auth/auth.controller.ts:49` |
| 27 | There is no `@ArrayMaxSize` on round tiers. | `modules/rounds/rounds.dto.ts:55` |
| 28 | There are no DB CHECK constraints on `units >= 1`, `stars` 1–5 or `unitsCount >= 0`. *(a migration, needs approval)* | `prisma/schema.prisma` |
| 29 | Disabling an offering or service leaves its OPEN rounds joinable. | `modules/catalog/catalog-admin.service.ts:145` |
| 30 | Pagination is missing: `GET /admin/rounds` stops at 200 with no cursor, and `GET /rounds/mine` has no limit. | `modules/rounds/rounds-admin.service.ts:48`, `modules/rounds/rounds.service.ts:125` |
| 31 | A deadline sent without a timezone is read in server local time. | `modules/rounds/rounds.dto.ts:52` |
| 32 | The rating and the DELIVERED → RATED change run in separate transactions. If the second fails, the round stays DELIVERED. *(plausible)* | `modules/rounds/ratings.service.ts:46` |
| 33 | The ValidationPipe drops unknown fields silently, because `forbidNonWhitelisted` and `transform` are off. | `bootstrap.ts:131` |
| 34 | The demo queue and its processor ship to production. *(deleting them needs approval)* | `app.module.ts:46` |
| 35 | The Prisma connection pool is left at its default, with no `connection_limit`. | `.env.prod.example:8` (repo root) |
| 36 | The stub SMS channel logs full message bodies. | `modules/notifications/stub-sms.channel.ts:47` |

## Checked and fine

- **Guards:** every admin route uses `AccessTokenGuard`, `RolesGuard` and `@Roles(SUPER_ADMIN)`. Resident, `/me` and catalog reads are limited to the caller's society.
- **Tokens:** access and refresh tokens use separate secrets, with `HS256` pinned. Refresh rotation is an atomic compare-and-set in Redis.
- **OTPs:**
  - Codes are stored as an HMAC, and verification is an atomic budgeted Lua script.
  - The admin door gives no clue whether a number belongs to an admin.
  - OTPs are sealed in job data and never logged.
- **Proxy:** `TRUST_PROXY=true` is refused.
- **CORS and helmet:** CORS is an exact-origin allowlist, closed by default in prod. Helmet is on.
- **Rounds:**
  - Join, edit and leave take `SELECT … FOR UPDATE` and apply relative increments.
  - A partial unique index allows only one OPEN round per society and service.
  - The closer is idempotent.
- **Outbox:** rows are written in the same transaction as the change, with a unique `dedupeKey` and idempotent job ids.
- **Payments:** allowed only in ASSIGNED, DELIVERED or RATED, and cancelling is blocked while any payment is collected.
- **Ratings:** they require a participant, a DELIVERED or RATED round, and the same society.
- **BullMQ:** jobs set attempts, backoff and bounded `removeOn*`.
- **Shutdown:** hooks cover Prisma, Redis and the workers.
- **Container:** runs as a non-root user.

## Suggested order

1. **Launch blockers (small changes):** #1, #2, #4, #5, #6.
2. **Session hardening (one change):** #3, #7, #8, #17.
3. **OTP abuse:** #9, #10, #11.
4. **Recovery and reliability:** #12, #13, #14, #15.
5. **Business rules and performance:** #18–#22.
6. Everything else, as chores.

**Needs approval first (per CLAUDE.md):**
- #16: a new dependency.
- #28: a migration.
- #34: deleting files.
