# BUG-034 — Admin console has no Log out

**Status:** done · **Priority:** P1 · **Opened:** 2026-11-26 · **Reporter:** owner

## Observed vs expected

- **Observed:** the admin console (sidebar on desktop, drawer on phone) offers no way to log out. A platform admin (no society, FEAT-036) has no "Back to app" either, so they cannot sign out at all; a society admin must leave the console for Home to find it.
- **Expected:** a "Log out" control in the admin sidebar and drawer, for every admin; it asks first (same ConfirmSheet as FEAT-024), ends the session (BUG-017 path) and lands on the admin sign-in.
- **Where:** `apps/web/src/features/admin/AdminLayout.tsx`, all environments. Owner: "we noy givine logout button for admin dashboard fix this".

## Reproduction (the spec for this bug)

- **Failing test:** `apps/web/src/features/admin/AdminLayout.test.tsx` — "BUG-034" cases (sidebar + drawer show Log out for a platform admin; confirming signs out and goes to /admin/login).
- **Reproduced on:** 2026-11-26

## Root cause

FEAT-034 built the console nav with only section links plus "Back to app"; the sign-out (FEAT-024) was only placed on Home and Profile. FEAT-036 then hid "Back to app" for platform admins, leaving them with no exit.

## Decision-log check

No ADR decides where sign-out lives beyond FEAT-024's Home/Profile placement; ADR-0034 (session end) and ADR-0046 (platform admin) are unaffected. No supersede needed.

## Fix

- **Commit:** f0d1075 (fix) + V2 follow-up (Escape closes one layer, extra tests)
- **Regression guard:** the BUG-034 tests in AdminLayout.test.tsx (sidebar, drawer, confirm → /admin/login, society admin, Escape layering) and the `useSignOut('/admin/login')` case in useSignOut.test.tsx.

## Lesson

none
