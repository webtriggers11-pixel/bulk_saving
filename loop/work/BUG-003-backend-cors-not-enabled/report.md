# BUG-003 — Browser calls from the web PWA fail: the API never sends CORS headers

**Status:** in-progress (V2/V3 blocked — see LOG 2026-09-17) · **Priority:** P1 · **Opened:** 2026-09-17 · **Reporter:** human (dev session, "CORS errors")

## Observed vs expected

- **Observed:** Every cross-origin request from `apps/web` (Vite dev server, `http://localhost:5173` / `:5174`) to the API on `http://localhost:3000` is blocked by the browser. No response carries `Access-Control-Allow-Origin`, and any preflight (`OPTIONS`) is answered `404 NOT_FOUND` by the router, so the app cannot log in, load a catalog, or join a round from a browser at all.
- **Expected:** The API accepts browser requests from the configured web origins: preflight answered with the CORS headers, and actual responses carrying `Access-Control-Allow-Origin`. Unknown origins get no CORS headers (browser blocks them).
- **Where:** `apps/backend/src/main.ts` — `bootstrap()` never calls `app.enableCors()`.

## Reproduction

Backend running (`pnpm --filter backend dev`), 2026-09-17:

```
$ curl -i -X OPTIONS http://localhost:3000/auth/otp/request \
    -H 'Origin: http://localhost:5174' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: content-type'
HTTP/1.1 404 Not Found
{"success":false,"error":{"code":"NOT_FOUND","message":"Cannot OPTIONS /auth/otp/request"}}

$ curl -i http://localhost:3000/health -H 'Origin: http://localhost:5174'
HTTP/1.1 200 OK        # no Access-Control-Allow-Origin header
```

- **Failing test:** `apps/backend/test/cors.integration.spec.ts` — preflight from an allowed origin must be 204 with `Access-Control-Allow-Origin`; before the fix it is 404 with no CORS headers.

## Root cause

CORS was never configured. The API and the PWA are separate origins by design (ADR-0002: `apps/backend` + `apps/web`; ARCHITECTURE.md), but nothing in the stack contract or any ADR ever decided a CORS policy, so `bootstrap()` shipped without `enableCors`. It went unnoticed because every backend test drives the app through supertest in-process, where the browser's same-origin policy does not exist.

A second factor made it visible today: `apps/web` came up on port **5174** (5173 was taken by an unrelated project), so a hard-coded single-origin allowlist would have been wrong too.

## Decision-log check

No existing ADR covers CORS (grep over `loop/decisions`, `ARCHITECTURE.md`, `STACK.md`: no hits). This is a gap, not a reversal — recorded as **ADR-0014**.

## Fix

- `configureApp()` extracted to `apps/backend/src/bootstrap.ts`: the single place that applies the validation pipe, exception filter, response interceptor **and CORS**. `main.ts`, `test/helpers/test-app.ts` and the health spec all call it, so the wiring can no longer drift between runtime and tests (it already had drifted — that is why the tests were blind to this).
- Origin policy (ADR-0014): `CORS_ORIGINS` (comma-separated) is the allowlist. When it is unset and `NODE_ENV !== 'production'`, any `http://localhost:<port>` / `http://127.0.0.1:<port>` origin is allowed, so a shifting Vite port never breaks local dev. In production an unset/empty `CORS_ORIGINS` allows nothing.
- No `Access-Control-Allow-Credentials`: auth is Bearer-token only, no cookies (see `apps/web/src/features/auth/auth.store.ts`).
- **Regression guard:** `apps/backend/test/cors.integration.spec.ts`.

## Lesson

Test helpers that re-create the app's global wiring by hand will drift from `main.ts`, and every gap in that drift is invisible to the test suite. Bootstrap configuration belongs in one exported function that both production and tests call.
