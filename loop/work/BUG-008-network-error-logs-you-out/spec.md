# BUG-008 — A server hiccup signs the resident out

**Status:** in-review (autonomous) · **Priority:** P1 · **Opened:** 2026-09-19

## Symptom

Found in the browser during CHORE-009: with the API stopped, reloading the app did not
show the offline/error state the design draws — it **redirected to `/onboard`**. The
session was gone. Signing back in needs an SMS OTP, which on a real phone means the
resident cannot get back in until the network returns *and* a code arrives.

## Reproduction

1. Sign in, confirm `/my-requests` renders.
2. Stop the API (`lsof -ti:3000 | xargs kill`).
3. Reload `/my-requests`.

Observed: `/onboard`, session cleared. Expected: the screen's error state, session intact.

## Cause

`lib/api.ts` `doRefresh()` wraps the refresh call in `try { … } catch { logout(); return null; }`.
The `catch` cannot tell these apart:

- **the server rejected the refresh token** (expired, rotated, revoked) — logging out is right;
- **the request never reached a server** (API down, DNS, CORS, captive wifi) — logging out
  throws away a session that is still perfectly valid.

A 401 on any request triggers the refresh path, so an unreachable API ends every session it
touches. Offline is *not* affected — TanStack pauses queries when `navigator.onLine` is
false (BUG-004), so nothing fetches and nothing 401s. It is the "online but the server is
not there" case that bites, which is the common one on Indian mobile data.

## Regression test (written first)

`api.test.ts`: with a refresh that rejects with a `TypeError` (what `fetch` throws on a
network failure), the session must survive and the original error must surface. And with a
refresh the server answers 401, the session must still be cleared — so the fix cannot be
"never log out".

## Fix

Separate the two. A response the server actually sent and refused → `logout()`. A thrown
fetch → leave the session alone and return null; the caller surfaces the failure, and the
existing `QueryErrorState` already has the copy for it.

## Out of scope

Anything server-side. This is `apps/web/src/lib/api.ts` only.
