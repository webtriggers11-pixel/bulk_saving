# BUG-035 — Admin Log out is not visible on the dashboard

**Status:** in-progress (fix committed) · **Priority:** P1 · **Opened:** 2026-11-28 · **Reporter:** owner

## Observed vs expected

- **Observed:** owner: "in admin dahsboard give logout button". BUG-034 put Log out at the END of the
  sidebar's scrolling nav (`overflow-y-auto`, after 4 groups / 9 links), so on a laptop-height screen it
  sits below the fold inside the sidebar; on a phone it exists only inside the menu drawer. The demo
  server also predates BUG-034 (not deployed).
- **Expected:** Log out is visible on every admin screen without scrolling or opening anything:
  pinned at the bottom of the desktop sidebar (outside the scrolling list), and as an icon in the
  phone top bar. Same confirm sheet, lands on /admin/login.
- **Where:** `apps/web/src/features/admin/AdminLayout.tsx`, all environments.

## Reproduction (the spec for this bug)

- **Failing test:** `apps/web/src/features/admin/AdminLayout.test.tsx` — "BUG-035" cases (phone top bar
  offers Log out without opening the menu; the sidebar's Log out is outside the scrolling list).
- **Reproduced on:** 2026-11-28

## Root cause

BUG-034 placed the sign-out row in the same scroll container as the section links, and only in the
drawer on phones — present, but not discoverable.

## Decision-log check

No ADR governs sign-out placement (BUG-034 report). ADR-0022 (admin console density) unaffected.

## Fix

- **Commit:** <pending>
- **Regression guard:** the BUG-035 tests in AdminLayout.test.tsx.

## Lesson

none
