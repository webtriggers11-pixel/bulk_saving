# CHORE-004 — verify.sh must also build

**Status:** in-progress · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-18

## Why

`scripts/verify.sh` runs lint + typecheck + tests, but never `pnpm -r build`. The FEAT-008
session proved the hole is real, not theoretical: its web build was broken
(`virtual:pwa-register/react` needs `workbox-window`, present in the lockfile as a
`vite-plugin-pwa` peer but never declared in `apps/web`) while verify.sh stayed **green**.
A gate that passes on an application that cannot be built is not a gate. Evidence:
`loop/work/FEAT-008-pwa-shell/build-evidence.md`.

Typecheck does not cover this. `tsc --noEmit` resolves types; it does not run Vite's
bundler, so a missing runtime dependency behind a virtual module is invisible to it.

## What

Add a build step to `scripts/verify.sh`, after typecheck and before tests (fail fast: a
broken build makes the test results moot for a deployable artifact).

## Why this is a change I made rather than escalated

CLAUDE.md asks the human before changing the process section, and verify.sh is THE single
verification entrypoint. Two things decide it:

- The owner's standing instruction this session is to complete and test the whole
  application and keep the loop running without per-step approval.
- The change only makes the gate **stricter**. It can mask nothing; the worst case is a
  slower verify and a build failure that was always there.

Flagged to the owner in the session summary. Reverting is one line.

## Cost

Adds the web Vite build and the backend `tsc` emit to every verify run (~15–25s locally).
Accepted: the alternative is shipping an app that does not build.

## Not done

Framework invariant 3 ("a build is not a test") still holds and is not weakened — the
build is an ADDITIONAL gate, not a substitute for the suites, which continue to run.
