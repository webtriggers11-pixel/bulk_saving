# FEAT-008 — PWA shell: installable, mobile-first, survives a flaky connection

**Status:** specced · **Priority:** P2 · **Owner:** agent (autonomous) · **Opened:** 2026-09-18

## Problem / Why

BRIEF.md feature 7 and ARCHITECTURE.md:178 both call for an installable,
mobile-first PWA that is graceful on a flaky connection. Today `vite-plugin-pwa`
is configured with a manifest and icons (CHORE-001), but nothing above that
exists: there is no app shell, so every resident page is a bare route with no
navigation; BRIEF's resident nav (`Home · Services · My Requests · Profile`) is
unreachable — `/profile` does not exist at all; there is no install affordance,
no offline feedback, and no way to pick up a new deploy. A resident on Indian
mobile data who loses signal mid-round sees a blank screen or a silent failure.

Taken now because it is the last feature that does not touch the backend: the
rounds and notifications modules are being changed by FEAT-006 in a parallel
session, and FEAT-007 (rating) needs a schema change that would collide with it.
FEAT-008 is `apps/web`-only, so it can proceed safely in parallel.

## User stories

1. As a resident, I can move between Home, Services, My Requests and Profile
   from a thumb-reachable bar, so I can use the app one-handed on a phone.
2. As a resident, I can add the app to my home screen, so I reach it without
   typing a URL.
3. As a resident on a flaky connection, I can see that I am offline and what data
   is stale, so I never mistake a network failure for "my round disappeared".
4. As a resident, I can see my phone, society and role, and log out, so I can
   hand the phone to a neighbour without exposing my account.
5. As a resident whose app was updated, I can load the new version with one tap,
   so I am not stuck on a stale build after a deploy.

## Acceptance criteria (testable — this IS the definition of done)

- [ ] AC1 — A bottom tab bar renders on resident routes with exactly four tabs:
      Home (`/`), Services (`/services`), My Requests (`/my-requests`), Profile
      (`/profile`). The tab matching the current route carries `aria-current="page"`.
- [ ] AC1b — `/my-requests` lists the rounds this resident joined in ANY status
      (`GET /rounds/mine`), each with its pledge, current price and a
      resident-language status line; the raw status enum never reaches the UI,
      and the empty state links to the open rounds instead of dead-ending.
- [ ] AC2 — The tab bar is absent on `/onboard` and on every `/admin/*` route
      (the super-admin dashboard keeps its own navigation).
- [ ] AC3 — Mobile-first: the bar sits above the iOS safe-area inset, every tab
      is at least 44×44 CSS px, and no resident page scrolls horizontally at a
      360 px viewport.
- [ ] AC4 — `/profile` shows the signed-in resident's phone, society name and
      role, and a Log out control that clears the session and lands on `/onboard`.
- [ ] AC5 — An "Install app" control appears only after the browser fires
      `beforeinstallprompt`; clicking it calls `prompt()` and the control
      disappears once the user has chosen. Where the event never fires (iOS
      Safari), a one-line "Share → Add to Home Screen" hint shows instead.
- [ ] AC6 — While the browser reports offline, every resident page shows a
      persistent offline banner; it disappears on reconnect without a reload.
- [ ] AC7 — A data view whose request fails while offline shows an explicit
      "You're offline" state with a Retry control — never an empty list that
      reads as "no rounds" — and shows already-cached data when the query cache
      has it.
- [ ] AC8 — After the first visit, the app shell (HTML, JS, CSS, icons) loads
      from the service worker with the network off, so the app opens offline.
- [ ] AC9 — When a new service worker is waiting, a reload prompt appears;
      activating it loads the new build.
- [ ] AC10 — `bash scripts/verify.sh` exits 0, with Vitest/RTL coverage for
      AC1–AC2, AC4–AC7 and AC9 (AC3 and AC8 are verified by inspection and a
      built-output check — see plan.md).

## Out of scope (explicit, prevents gold-plating)

- **Web push notifications** — BRIEF calls them a bonus; they belong with
  FEAT-006's notification work, not the shell.
- **Offline writes / background sync** — joining or changing a pledge while
  offline. Unit counts are authoritative in Postgres under a row lock
  (ADR-0004); a queued offline pledge would pledge against a stale tier. Offline
  is READ-ONLY in v1.
- **Service-worker caching of authenticated API responses** — see ADR-0015; the
  privacy cost on a shared phone is not worth it at v1 volumes.
- **Persisting the TanStack Query cache to storage** — would need a new
  dependency (`@tanstack/query-sync-storage-persister`), and dependencies need
  human approval.
- **An offline-capable admin dashboard** — desk tool, assumed online.
- **A redesign** — this is a shell around the existing pages, not a restyle.
  Design work stays with the existing hand-rolled primitives (ADR-0008).

## Open questions

- ~~"My Requests" maps to the existing `/rounds` page~~ → **resolved 2026-09-18,
  mid-build:** wrong on the facts. `GET /rounds` is OPEN-only, so a closed round
  would vanish from the tab. The parallel FEAT-007 session added
  `GET /rounds/mine` (joined rounds, any status) and flagged it; the tab now has
  its own route, `/my-requests`. ADR-0015 amended accordingly.
- Offline stays read-only (ADR-0015), unchanged.
