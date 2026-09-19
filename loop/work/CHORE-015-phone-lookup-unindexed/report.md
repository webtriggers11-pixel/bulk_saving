# CHORE-015 — the admin door drives an unindexed scan on `phone`

**Status:** triaged · **Priority:** P2 · **Opened:** 2026-09-19 · **Found by:** V2 review of FEAT-012

## What

`ResidentsService.findAdminByPhone` queries `Resident` on `phone` alone. The only index
covering that column is `@@unique([societyId, phone])`, whose LEADING column is
`societyId` — so a phone-only predicate cannot use it and Postgres falls back to a scan.

It is reached from `POST /auth/admin/otp/request`, which is **unauthenticated**. The
global throttler allows 120 requests/minute/IP; each one is a sequential scan of the
resident table.

## Why it is not fixed here

The fix is an index, which is a Prisma migration — and CLAUDE.md requires the owner's
say-so before any migration. Recorded rather than done quietly.

## The fix, when approved

```prisma
@@index([phone])
```
on `Resident`, then `prisma migrate dev --name resident_phone_index`. Small table today;
the cost of waiting is low and the cost of the migration is also low, which is exactly
why it should be a deliberate decision rather than a side effect of an auth change.
