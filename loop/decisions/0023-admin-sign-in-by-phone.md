# ADR-0023: Admins sign in through their own endpoint pair, with the society derived from their row

**Status:** Accepted
**Date:** 2026-09-19 · **Deciders:** Vivek (asked for a separate admin page that takes only a number), agent · **Work item:** FEAT-012

## Confidence

**Level:** Medium
**Basis:** The shape is unremarkable — a second credential path over the same OTP service,
with the tenant claim derived server-side exactly as ADR-0003 already requires. What keeps
this from High is the enumeration trade-off below, which is a product judgment about a dev
-stage app, not a settled security answer.

## Research depth

**Judgment call.** No external research. The decision follows from constraints already in
this codebase: ADR-0003 (societyId never from the body), ADR-0007 (phone+OTP), ADR-0020
(the code never leaves through the API).

## Context and problem

The invite code does two jobs in the resident flow: it proves you belong to a society, and
it *tells the server which society you mean*. An admin needs neither — they already have a
row, and that row already names their society. Asking them for a resident's credential is
the visible symptom; the real design question is where `societyId` comes from once the
invite code is gone.

## Options considered

1. **A separate endpoint pair that looks the admin up by phone** — the society comes from
   the admin's own `Resident` row. Pro: the resident path is untouched, and the admin path
   cannot be talked into a different tenant. Con: two request paths to keep honest.
2. **Make `inviteCode` optional on the existing endpoints** — rejected. The DTO would stop
   being able to state its own contract, and every branch inside would have to re-derive
   which mode it is in. Two clear paths beat one that means two things.
3. **Let the client send `societyId` when there is no invite code** — rejected outright.
   That is the exact input ADR-0003 exists to refuse.

## Decision

1. `POST /auth/admin/otp/request` and `POST /auth/admin/otp/verify`, taking a phone (and a
   code) and nothing else.
2. The society is read from the **single SUPER_ADMIN row** matching that phone. Filtered
   on role, and unique among admin rows rather than among all rows: an administrator of
   one society who later joins another through the resident door holds two rows with the
   same number, and treating that as ambiguous would lock them out of the dashboard by
   way of using the product normally. Two ADMIN rows is still ambiguous — there is no one
   society to sign them into.
3. **Nothing an unauthenticated caller can observe differs between an administrator, a
   resident and a stranger.** This is stronger than "the same response body", which is
   all the first implementation delivered — and it was not enough:

   - Returning early for a non-admin left the rate limiter untouched for them, so two
     requests 30s apart answered `200, 429` for an administrator and `200, 200` for
     everyone else. A perfect oracle, produced by the very branch meant to prevent one.
   - Scoping the OTP by the caller's own society meant a registered number had a stored
     OTP key where an unregistered one did not, so `verify` answered `OTP_EXPIRED` for
     one and `OTP_INVALID` for the other — registration status in a single request.

   So: **the admin door has ONE OTP scope** (`ADMIN_OTP_SCOPE`, a server constant, not a
   society id), and **every caller takes every step** — limiter, generation, storage.
   The only thing that varies is whether the SMS is dispatched, which is the one effect
   the caller cannot see. A non-admin's code is generated and stored and sent nowhere.
4. **The admin verify path never creates a resident.** The resident path upserts, because
   joining a society IS the act of creating the account. Signing in as an admin is not;
   an unknown phone gets 403, never a new row.
5. **The role is checked after the code, never before it.** Looking the caller up first
   is what produced the second oracle in (3), and it also made the 403 unreachable.
   Checking afterwards means the plain answer — "this number is not an administrator" —
   is only ever given to someone holding a code that was generated for that number and
   sent nowhere, i.e. someone who already controls it. Without the OTP the admin door
   says nothing at all.

## Consequences

Good: an admin needs only their number. The tenant claim still comes from the server on
both paths. Nothing about the resident flow changed, so nothing about it can have broken.

Bad: a resident who types their number into the admin page waits for an SMS that never
arrives, because (3) means the admin door sends nothing to a non-admin. They are stuck at
a code they will not receive. The page says who it is for; the API still does not.

The `NOT_AN_ADMIN` refusal is consequently reachable by exactly one route: a number that
WAS an administrator when it requested a code, and is not one when it presents it. A
resident-door code cannot be brought here — the scopes are `otp:<societyId>:<phone>` and
`otp:admin-door:<phone>`, so it answers `OTP_INVALID` like any other wrong code. (An
earlier draft of this section claimed the opposite; the single-scope decision in (3)
made it false and the prose was not updated with it — V2 round 2, P3-G.)

## What this costs

Every phone poked at the admin door gets **three** Redis keys written, for any number at
all: the OTP itself (5 min), the resend interval (30s) and the hourly counter (1 hour).
Previously a non-admin wrote none. The phone DTO accepts `^\+?[0-9]{7,15}$`, so the key
space is effectively unbounded and the only volume cap is the global 120 req/min/IP
throttler. That is the price of uniformity: the alternative is state that differs by
caller, and state that differs by caller is readable.

The send is dispatched but **not awaited**. Suppressing it for non-admins equalised the
status, the body and the stored state, and left the one step that costs real time inside
an administrator's response and nobody else's — with a real provider, ~230ms against
~13ms, so a single unauthenticated request separated the two by 15× (V2 round 2, P1-A).
Nothing is lost by not awaiting it, because this response is uniform by design: the
send's outcome could never have reached the caller. A provider that throws is logged
rather than becoming a 500 for administrators and a 200 for everyone else.

Not addressed here: `findAdminByPhone` queries on `phone` alone, and the only index is
`@@unique([societyId, phone])`, whose leading column is `societyId`. An unauthenticated
caller can therefore drive an unindexed scan. Adding an index is a migration, which
needs the owner — recorded as CHORE-015 rather than done quietly.

## Revisit trigger

If admin sign-in support requests become common enough that the misleading "Incorrect code"
is the actual cost centre, revisit (3) — most likely by rate-limiting per IP and answering
honestly, rather than by keeping a message that is technically true and practically wrong.
