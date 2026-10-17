# BUG-011 — One component that throws blanks the entire app

**Status:** done · **Priority:** P1 · **Opened:** 2026-10-17 · **Closed:** 2026-10-17 · **Found by:** FEAT-015 browser pass

## What happened

A render-time ReferenceError in `FilterChips` (a hook placed above the variable it read)
turned every screen that uses it — and, because routing re-rendered, the whole page —
into an empty background. No message, no way back, no report.

## Why it matters

The app has no React error boundary and no router `errorElement` (`grep` finds neither).
In production a single bad response shape or a null in one row has the same effect: the
resident sees a blank screen and assumes the product is broken, because it is.

## Fix when taken

A top-level boundary with a "Something went wrong — reload" screen on the design system,
plus a per-route boundary so one failing screen leaves the shell and nav usable. A test
that renders a throwing child and asserts the shell survives. (A failing test first:
this is a bug.)
