# ADR-0015: The PWA precaches the app shell only — no service-worker caching of authenticated API responses, and offline is read-only

**Status:** Accepted
**Date:** 2026-09-18 · **Deciders:** agent (autonomous) · **Work item:** FEAT-008

## Confidence

**Level:** High for the shell-only caching boundary · Medium for the update flow ·
**Low for the "My Requests" routing clause** (added 2026-09-18 after that clause
was refuted within hours — see ADR-0016)
**Basis:** The privacy argument is structural, not empirical: a Workbox runtime
cache is keyed by URL and shared by every user of that browser profile, while
this API's tenant scoping lives in the `Authorization` header (ADR-0003), so a
URL-keyed cache cannot distinguish two residents. That reasoning needs no
research. Medium on the update flow because `registerType: 'autoUpdate'` plus an
explicit reload prompt is one of several defensible combinations, and the choice
rests on judgment about a resident's tolerance for a surprise refresh.

**Low on the routing clause, recorded after the fact (V2 P1-5).** It was written
as if it were a free consequence of the caching decision, and carried no research
at all: the shape of `GET /rounds` was never checked, and one look at the
controller would have shown it is OPEN-only. It deserved "Judgment call / Low"
with a revisit trigger from the start, and this ADR's confidence section should
have said so. Recording it here rather than quietly correcting the level, because
an honest confidence rating is only worth anything if it survives being wrong.

## Research depth

**Depth:** Quick check

**Sources:** (none of which covered the routing clause — that is the point of
the Low rating above)
- `vite-plugin-pwa` 0.21 (installed) — confirmed `virtual:pwa-register/react`
  ships with the plugin (`useRegisterSW`), so the update prompt needs **no new
  dependency**, and that `registerType: 'autoUpdate'` is already set in
  `apps/web/vite.config.ts` from CHORE-001.
- Workbox `generateSW` defaults as used by that plugin — precache manifest covers
  the built shell assets; `navigateFallback` serves the SPA offline. Runtime
  caching of API calls is opt-in, i.e. absent unless we add it.

## Context and problem

BRIEF feature 7 asks for a PWA that "works on a flaky connection". The tempting
reading is "cache the API so the app works offline". Three constraints push back:

1. **Tenancy is in the header, not the URL.** `GET /rounds` returns a different
   body per resident and per society, scoped from the JWT (ADR-0003). A Workbox
   cache keyed on the URL would serve resident A's rounds to resident B on the
   same phone — a real scenario, since this product is sold society-by-society
   and phones get handed around. Cache-busting by user would mean keying every
   entry by token, purging on logout, and getting it right in a service worker
   that outlives the page.
2. **Round data goes stale fast and stale data is misleading.** Unit counts, the
   current tier and the price change as neighbours join; the deadline decides
   whether joining is even possible. A cached round card showing "6 of 10 units,
   ₹800" when the round closed an hour ago invites a pledge that cannot happen.
3. **Offline writes are unsafe here by construction.** Joins are serialized on a
   `SELECT ... FOR UPDATE` of the round row and the count is authoritative in
   Postgres (ADR-0004). A pledge queued offline would be computed against a tier
   that may no longer exist. There is no correct client-side resolution.

## Options considered

1. **Shell-only precache + honest offline UI (chosen)** — the service worker
   precaches the built shell so the app opens offline; API data comes from the
   network or the in-memory TanStack Query cache, and its absence is shown
   explicitly. Pro: no cross-user leak, no stale-price trap, nothing to purge on
   logout. Con: with the network off and a cold tab, a resident sees the shell
   and an offline state rather than their last-known rounds.
2. **Runtime-cache API GETs (network-first, short TTL)** — rejected for v1: it
   buys "last-known rounds on a cold tab" at the cost of a URL-keyed cache
   holding one resident's tenant data for whoever opens the browser next, plus
   stale tier/price readings. Revisit only with per-identity cache keys and a
   logout purge.
3. **Persist the TanStack Query cache to localStorage** — rejected: needs a new
   dependency (human approval), and it has the same staleness and shared-device
   problems as option 2, just in a different layer.
4. **Offline write queue (background sync) for joins** — rejected outright, see
   constraint 3. Not a v1 gap; a correctness impossibility.

## Decision

The service worker precaches **only** the built shell (HTML, JS, CSS, icons,
manifest) with an SPA navigation fallback. It caches **no** API response. Offline
behaviour is read-only and explicit: an offline banner while the browser reports
offline, and a per-view "You're offline / Retry" state where a request failed,
showing already-fetched data from the in-memory query cache when it exists.

`registerType: 'autoUpdate'` stays, and the app additionally surfaces a reload
prompt via `useRegisterSW` when a new worker is waiting, so a resident is never
silently mid-refresh and never stuck on a stale build.

"My Requests" in BRIEF's nav maps to the existing `/rounds` page. No new route,
no duplicate data view.

> **This clause is superseded by [ADR-0016](0016-my-requests-own-route.md)
> (2026-09-18).** It was wrong: `GET /rounds` is OPEN-only, so a joined round
> would vanish from the tab the moment it closed. The original text is left
> intact above because `loop/framework.md` calls ADRs immutable — an earlier
> edit had rewritten it in place, which V2 (P2-5) correctly flagged as using the
> wrong mechanism. The reasoning now lives in ADR-0016.

## Consequences

- Good: no cross-user data leak through a shared cache, and no purge-on-logout
  machinery to get wrong.
- Good: the app always opens — installed, offline, from the home screen — and
  what it cannot show, it says it cannot show.
- Good: zero new dependencies.
- Bad: offline with a cold tab shows no round data at all. A resident who force-
  quit the app and lost signal gets an offline state, not yesterday's rounds.
  This is the deliberate trade: honest emptiness over a misleading price.
- Bad: "works on a flaky connection" is delivered as *fast shell + clear
  feedback*, which is weaker than what a reader of BRIEF feature 7 might picture.
  Called out here so the gap is a decision on record, not an oversight.

## Revisit trigger

Re-examine when any of these happens:

- Residents report "I could not see my rounds on the metro / in the lift" often
  enough to matter — then implement option 2 properly: cache keyed per resident
  identity, purged on logout, with a visible "last updated HH:MM" on every
  cached view.
- Auth moves to httpOnly cookies (already a live trigger in ADR-0014), which
  changes what a URL-keyed cache can see.
- A read endpoint appears whose response is genuinely tenant-independent (a
  public service catalog, say) — that one is safe to runtime-cache on its own.
