# BUG-004 — Offline, admin controls hang silently ("Saving…" forever)

**Status:** in-progress · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-18

## Symptom

With the browser offline, pressing any admin action — Add vendor, Save, Assign vendor,
Close round, Mark delivered, Cancel round, the payment toggle, Open round — leaves the
button reading "Adding…" / "Saving…" / "Assigning…" indefinitely. No error, no explanation,
no recovery. The admin has no way to tell whether the write happened.

The admin *reads* have the matching version of the fault: `GET` failures are gated on
`isError` alone, so an offline cold load renders a header and nothing else — no error, no
Retry.

## Root cause

TanStack Query v5's default `networkMode: 'online'` **pauses** work when the browser is
offline rather than failing it:

- mutations: `isPaused` true, `isPending` stays true, `isError` false, nothing rejects;
- queries: `fetchStatus` is `'paused'`, `isError` false, `isLoading` false, `data` undefined.

Every admin control gates purely on `isPending` / `isError`, so the paused state renders as
a permanent in-flight state.

Not a regression: it has been true since the admin UI landed (FEAT-005). It surfaced now
because the FEAT-008 V2 review found the query-side case on the resident pages, and that
generalises to mutations (FEAT-009) and to every admin surface (this bug).

## Why it matters

The BRIEF's users are on Indian mobile data, and the super-admin is the founder doing ops
from a phone between societies. A silently-hanging write is worse than a visible failure:
they will either give up or press it again and again, believing nothing happened.

## Fix

One shared helper (`lib/offline.ts`) so the decision is made in a single place and the copy
cannot drift between fifteen controls:

- `queryStalled({ isError, fetchStatus })` — an error OR paused, used to gate every error
  state;
- `OFFLINE_QUEUED_TEXT` / `OFFLINE_WAITING_LABEL` — the honest copy for a paused mutation.
  It says *queued*, not *failed*, because a paused mutation genuinely does resume on
  reconnect.

Applied to the four admin pages and to the FEAT-009 rating control (which had the same hole
and is where the pattern was worked out).

## Testing note

A rejected promise does NOT reproduce this — that is the server-error path, and it was
exactly why the existing tests passed while the bug was live. Offline must be driven with
`onlineManager.setOnline(false)`.

## Follow-up (not done here)

The resident pages other than My Requests (Home, Services, Rounds) were fixed by the
FEAT-008 session. After this, every mutation-driven control in the app should have a paused
state; a lint rule or a shared `useMutationState` wrapper would stop the next one being
written without it. Recorded as a CHORE candidate rather than taken.
