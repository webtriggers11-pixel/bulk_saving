# Plan FEAT-008 — PWA shell

**Derived from:** spec.md · **Approved by:** agent (autonomous mode, per owner's
standing instruction to run the loop without per-step approval) on 2026-09-18

## Technical approach

Smallest design that satisfies AC1–AC10, entirely inside `apps/web`. No backend
change, no new dependency, no restyle (ADR-0008 primitives as-is).

1. **`features/shell/AppShell.tsx`** — a layout component: `<main>` + the tab
   bar, with `pb` padding so the bar never covers content, and
   `env(safe-area-inset-bottom)` honoured. `App.tsx` wraps the four resident
   routes in it; `/onboard` and `/admin/*` stay outside it (AC2).
2. **`features/shell/BottomNav.tsx`** — the four tabs from BRIEF's resident nav.
   `NavLink` from react-router (already a dependency) gives the active state;
   each link sets `aria-current="page"` when active (AC1) and is `min-h-11
   min-w-11` (44 px, AC3). Inline SVG icons — no icon dependency.
3. **`features/profile/ProfilePage.tsx`** + route `/profile` — reads the auth
   store for phone / society / role, renders them, and a Log out button calling
   the store's `logout()` then navigating to `/onboard` (AC4). Also hosts the
   install affordance and the app's offline/version state, so the shell has one
   home for device-level concerns.
4. **`features/shell/useInstallPrompt.ts`** — captures `beforeinstallprompt`
   (preventDefault, stash the event), exposes `{ canInstall, promptInstall }`;
   after `prompt()` resolves, clears it. When the event never fires, the Profile
   page shows the iOS "Share → Add to Home Screen" line (AC5).
5. **`features/shell/useOnlineStatus.ts`** — `navigator.onLine` plus `online` /
   `offline` listeners, so reconnect clears the banner with no reload (AC6).
   `features/shell/OfflineBanner.tsx` renders inside `AppShell`.
6. **`components/QueryState.tsx`** — one small presentational component for the
   "request failed while offline" state: offline copy + Retry wired to the
   caller's `refetch` (AC7). Used by the resident data pages; it shows cached
   data when TanStack Query has it (`data` present with `isError`), so a refetch
   failure never blanks a populated list.
7. **`features/shell/UpdatePrompt.tsx`** — `useRegisterSW` from
   `virtual:pwa-register/react` (ships with vite-plugin-pwa, ADR-0015); when
   `needRefresh` is true, a bar offers Reload → `updateServiceWorker(true)` (AC9).
   A tiny `src/test/pwa-register.mock.ts` stubs the virtual module under Vitest.
8. **Offline shell (AC8)** — already covered by the plugin's default precache +
   `navigateFallback`; the plan adds no runtime caching by decision (ADR-0015).
   Verified by asserting the built `dist/sw.js` + precache manifest include the
   shell entries, not by a browser test (no E2E in v1 per STACK.md).

## Data model / contracts

None. No API call, DTO, Prisma model or shared type changes. `packages/shared`
untouched. The only contract consumed is the existing auth store shape
(`phone`, `societyName`, `role`, `logout`) — read-only.

## New decisions required

- **ADR-0015** (written, Accepted) — shell-only precache, no SW caching of
  authenticated API responses, offline is read-only, update flow via
  `useRegisterSW`, "My Requests" maps to `/rounds`.
  Confidence High (caching boundary) / Medium (update flow); depth Quick check.

## Risks

- **`virtual:pwa-register/react` under Vitest** — a virtual module Vite resolves
  at build time; Vitest needs an alias to a stub or `UpdatePrompt` tests fail to
  resolve. Mitigation: alias in `vite.config.ts`'s test block (T1), so the risk
  surfaces on the first task rather than the last.
- **AC8 is asserted against build output, not a real offline browser.** A green
  build check does not prove a browser opens offline. Accepted for v1 (E2E is
  deferred in STACK.md); noted in the spec as verified by inspection.
- **Shared working tree** — FEAT-006 is being built by a parallel session in
  `apps/backend`. Every FEAT-008 file is under `apps/web`, so the diffs do not
  overlap; `verify.sh` runs are the only shared resource (one Postgres + Redis),
  so a run is taken when the backend tree is quiet, and the concurrency is noted
  in each LOG entry.
- **Supersede watch:** none. ADR-0008 (hand-rolled primitives) is followed, not
  revisited; ADR-0015's own revisit triggers cover the caching boundary.
