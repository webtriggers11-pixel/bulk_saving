# ADR-0053: The demo server opts its production PWA build into the dev OTP toast with `VITE_DEV_OTP_TOAST=true`

**Status:** Accepted (amends ADR-0037 for the demo server only)
**Date:** 2026-11-24 · **Deciders:** owner ("do it") + agent · **Work item:** BUG-033

## Confidence

**Level:** Medium
**Basis:** verified on the live server (bundle had no dev path; API runs the stub channel), and both build variants checked. Low for anything beyond a demo: the route is public there.

## Research depth

**Depth:** Quick check: the server's deploy script, its API env and journal, and Vite's build-time env replacement (checked by building both variants).

## Context and problem

The demo server (`savebulk.webtriggers.online`) has no SMS provider. Its API runs `NODE_ENV=development` + `OTP_DEV_LOG=true`, so codes only reach the stub channel and `/dev/otp`. Its PWA is a Vite production build, which compiled the toast out (ADR-0037 §3), so nobody could read a code. This is ADR-0037's revisit trigger ("the stub channel bound outside local development").

## Options considered

1. **A build-time opt-in `VITE_DEV_OTP_TOAST=true` (exact string), set only in the server's deploy build step.** Chosen. Default builds stay clean and `check-dev-only.mjs` still guards them.
2. **`OTP_DEV_FIXED_CODE=1111` on the server.** Needs the production-safety check relaxed, and is just as open.
3. **Remove the route and wire a real SMS provider.** The right end state; it costs money and needs a provider decision. Deferred.

## Decision

Option 1. The flag also bypasses the `MODE !== 'test'` guard, so it must never be exported in a developer shell: Vitest page suites would make dev requests and `check-dev-only` would fail the gate (it fails loudly).

## Consequences

- On the demo server, `/dev/otp` is reachable through nginx (the loopback guard sees nginx's 127.0.0.1). Anyone can read any phone's code for two minutes and sign in as that person. This was stated to the owner.

**Revisit trigger (mandatory):** before any real resident uses the server, or when an SMS provider is chosen: drop the flag from the deploy, set `NODE_ENV=production`, and remove the stub route there.
