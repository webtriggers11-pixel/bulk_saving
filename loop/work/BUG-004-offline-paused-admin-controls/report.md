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

A shared helper (`lib/offline.ts`) so the decision and the copy are defined once for the
admin surfaces and the rating control:

- `queryStalled({ isError, fetchStatus })` — an error OR paused, used to gate every error
  state;
- `OFFLINE_QUEUED_TEXT` / `OFFLINE_WAITING_LABEL` — the honest copy for a paused mutation.
  It says *queued*, not *failed*, because a paused mutation genuinely does resume on
  reconnect.

Applied to the four admin pages and to the FEAT-009 rating control (which had the same hole
and is where the pattern was worked out).

**Correction (V2 P1-8):** the first version of this report claimed "one shared helper … so
the decision cannot drift". That was not true as committed. The FEAT-008 session had already
added an equivalent `hasQueryFailed()` to `components/QueryState.tsx` one commit earlier, so
`fb4e403` shipped THREE implementations of the same predicate (that one, `queryStalled`, and
an inline copy in `MyRequestsPage`), plus two row-emptiness helpers with different semantics.
Introducing a second helper is exactly the drift this report says it prevents. The other
session opened CHORE-005 to consolidate them; this work item's remaining job is to end up on
whichever helper survives, not to add a fourth.

## Testing note

A rejected promise does NOT reproduce this — that is the server-error path, and it was
exactly why the existing tests passed while the bug was live. Offline must be driven with
`onlineManager.setOnline(false)`.

## V2 findings, fixed in the follow-up commit

- **P0-1 — the bug was still live on `/admin/rounds/:id`.** Its four mutation buttons were
  fixed while its TWO READS were missed, so an offline admin got the layout, the back link
  and nothing else. Worse, the assign form's vendor read fell through to
  **"No active vendors. Add a vendor to assign this round."** — a false statement caused by a
  network failure, whose obvious remedy is to create a duplicate vendor. Both reads now go
  through `queryStalled`, with offline-specific copy and a Retry.
- **P1-2/P1-3 — the read-side fix had no call-site coverage**, which is how P0-1 survived:
  reverting every `queryStalled` call left all 153 web tests green. Added
  `features/admin/offline-admin.test.tsx` (five surfaces, driven through `onlineManager`) and
  paused-read coverage for My Requests. Both were confirmed to FAIL against the unfixed code.
- **P2 — `OnboardingPage` was the last uncovered mutation surface**, and it is the app's
  front door: "Sending…" / "Verifying…" / "Resending…" hung forever offline. Now covered, so
  all 15 `useMutation` call sites have a paused state.

## Follow-up (not done here)

A lint rule or a shared `useMutationState` wrapper would stop the next control being written
without a paused state. Recorded as a CHORE candidate rather than taken. `hasRows` vs
`hasUsableData` consolidation belongs to CHORE-005 (the other session's).
