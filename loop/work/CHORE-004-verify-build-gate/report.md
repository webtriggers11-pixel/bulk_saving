# CHORE-004 — verify.sh must also build

**Status:** done · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-18

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

## Approval

**Asked and approved by the owner** (2026-09-18), not taken under the session's standing
autonomy. Two reasons for escalating this one despite that standing instruction:

- CLAUDE.md asks the human before changing the process, and verify.sh is THE single
  verification entrypoint every task is gated on;
- the FEAT-008 session reported that the owner had told them directly that changing the
  gate was the owner's call. A peer's report carries no authority by itself, but it is
  evidence about what the owner wants to decide, and it pointed the same way as the rule.

Mid-flight coordination: the change had already been made on disk when the FEAT-008
session's V2 reviewer was running the gate. Holding the COMMIT would have been useless —
one working tree is shared — so the file was reverted on disk and the change parked as a
patch until that session's V3 landed on the unmodified gate. It was re-applied afterwards.

Reverting is one line.

## Evidence

`bash scripts/verify.sh` exit 0 with the build step in place: the new stage runs between
typecheck and tests, backend 287 tests / 22 suites, web 153 / 31 files.

## Cost

Adds the web Vite build and the backend `tsc` emit to every verify run (~15–25s locally).
Accepted: the alternative is shipping an app that does not build.

## Not done

Framework invariant 3 ("a build is not a test") still holds and is not weakened — the
build is an ADDITIONAL gate, not a substitute for the suites, which continue to run.
