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
2. The society is read from the **single** `Resident` row matching that phone — zero
   matches and two matches are treated alike, so a number holding a row in two societies
   is refused rather than scoped to an arbitrary one. The lookup does not filter on role;
   see (5).
3. **The request step does not reveal who is an admin.** It answers `{ requested: true }`
   whether or not a code was sent. An endpoint that answers differently is a tool for
   sorting a leaked phone list into administrators and everyone else.
4. **The admin verify path never creates a resident.** The resident path upserts, because
   joining a society IS the act of creating the account. Signing in as an admin is not;
   an unknown phone gets 403, never a new row.
5. **The role is checked after the code, not before it.** Filtering the lookup by role
   would have made the 403 unreachable — every non-admin would fall out at the lookup
   with "incorrect code", and `NOT_AN_ADMIN` would be a branch that could never run.
   Checking afterwards means a resident who wandered onto the admin page is told the
   real reason, and that this reason is only ever disclosed to someone who has just
   proven control of the number. Without the OTP, the admin door says nothing.

## Consequences

Good: an admin needs only their number. The tenant claim still comes from the server on
both paths. Nothing about the resident flow changed, so nothing about it can have broken.

Bad: a resident who types their number into the admin page waits for an SMS that never
arrives, because (3) means the admin door sends nothing to a non-admin. They are stuck at
a code they will not receive. The page says who it is for; the API still does not. The
honest `NOT_AN_ADMIN` refusal is reachable only by someone who obtained a code through
the resident door and brought it here — which is the demoted-admin case, and it is the
one case where the plain answer costs nothing.

## Revisit trigger

If admin sign-in support requests become common enough that the misleading "Incorrect code"
is the actual cost centre, revisit (3) — most likely by rate-limiting per IP and answering
honestly, rather than by keeping a message that is technically true and practically wrong.
