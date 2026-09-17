# ADR-0014: CORS is an env-driven exact-origin allowlist that fails closed in production, with any-localhost allowed only in dev

**Status:** Accepted
**Date:** 2026-09-17 · **Deciders:** agent (autonomous) · **Work item:** BUG-003

## Confidence

**Level:** High
**Basis:** CORS is a settled browser standard and this is the conventional
server-side shape for it (exact-origin allowlist, no wildcard, no credentials
because the API is Bearer-only). The Nest/Express `cors` callback signature was
verified against the installed packages and pinned by the regression test, not
taken from memory.

## Research depth

**Depth:** Quick check

**Sources:**
- Nest `enableCors` / `CorsOptions` types in `node_modules/@nestjs/common/interfaces/external/cors-options.interface.d.ts` (installed v11) — confirmed the `origin(requestOrigin, callback)` form and the option names.
- MDN CORS reference (long-standing) — behaviour of `Access-Control-Allow-Origin`, preflight, and the wildcard/credentials interaction.

## Context and problem

`apps/web` (Vite, `http://localhost:517x`) and `apps/backend` (`http://localhost:3000`)
are separate origins by design (ADR-0002), and in production they will be
separate hosts too. `bootstrap()` never called `enableCors`, so **every** browser
call was blocked and preflights 404'd (BUG-003). Nothing in `STACK.md`,
`ARCHITECTURE.md` or any earlier ADR had decided a CORS policy.

Two constraints shaped the policy:

1. The dev web port is not stable — 5173 was occupied by an unrelated project on
   the dev machine, so the PWA came up on 5174. A hard-coded dev origin would
   break again on the next port shift.
2. Auth is Bearer-token only; the API sets no cookies
   (`apps/web/src/features/auth/auth.store.ts`), so cross-origin credentials are
   not needed — and `credentials: true` plus a loose origin rule is exactly the
   combination that turns a CORS mistake into account takeover.

## Options considered

1. **Env allowlist (`CORS_ORIGINS`), with any-localhost as the dev-only default** —
   one mechanism for every environment; dev needs no configuration and survives
   port shifts; prod is explicit. Con: two behaviours to keep straight, and the
   dev default must never leak into production.
2. **`origin: true` (reflect any origin)** — rejected: allows every site on the
   internet to drive the API with a victim's access token if it ever obtains one,
   and there is no real upside over option 1.
3. **A fixed list of dev ports (`5173`, `5174`, …)** — rejected: breaks on the
   next port shift, which is precisely how this bug surfaced.
4. **Vite dev proxy instead of CORS** — rejected as *the* fix: it papers over dev
   only and leaves production without any policy, so the same bug ships. (It
   remains available later as a dev convenience, on top of this.)

## Decision

`buildCorsOptions()` in `apps/backend/src/bootstrap.ts` builds the policy from env:

- `CORS_ORIGINS` set → exactly those origins, in every environment.
- Unset and `NODE_ENV !== 'production'` → any `http://localhost:<port>` or
  `http://127.0.0.1:<port>`.
- Unset in production → **nothing** is allowed (fail closed; a forgotten env var
  costs a visibly broken frontend, never a silently open API).

`credentials: false`. A refused origin is answered *without* CORS headers rather
than by throwing, so a blocked browser call never shows up as a 500 in the logs.
Requests with no `Origin` header (curl, server-to-server) are untouched.

The same commit extracts **`configureApp()`** as the single global-wiring
function that `main.ts` and all test helpers call.

## Consequences

- Good: local dev works on any port with zero configuration; production requires
  an explicit, reviewable list; no wildcard and no credentials, so the blast
  radius of a misconfiguration is small.
- Good: the global wiring can no longer drift between `main.ts` and the tests —
  the drift is what hid this bug from a 193-test suite.
- Bad: `NODE_ENV` now changes security behaviour. A deploy that forgets to set
  `NODE_ENV=production` **and** `CORS_ORIGINS` would allow localhost origins —
  harmless in itself (an attacker's page is not on the victim's localhost), but
  it means the fail-closed rule silently would not apply.
- Bad: browser clients on a non-localhost dev origin (a phone on the LAN testing
  the PWA, a tunnel URL) must be added to `CORS_ORIGINS` explicitly.

## Revisit trigger

Re-examine when any of these happens:

- The API needs cookie-based auth or any credentialed cross-origin request
  (`credentials: true` changes the whole risk calculus and forbids any loose
  origin rule).
- A first production/staging deploy is prepared — confirm `CORS_ORIGINS` and
  `NODE_ENV` are set there, and consider dropping the localhost default entirely.
- The PWA is tested from a non-localhost origin (LAN IP, ngrok/tunnel) often
  enough that hand-editing `CORS_ORIGINS` becomes friction.
