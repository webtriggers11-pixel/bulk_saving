# BUG-033: The demo server never shows the OTP toast, and no SMS is sent, so nobody can read their code

**Status:** in-progress · **Priority:** P1 · **Opened:** 2026-11-24

**Owner (2026-11-24):** "check on server why we not receiving OTP toast … find the root cause", then "do it".

## Root cause
- The demo server (`/production/savebulk/deploy.sh`) runs the API with `NODE_ENV=development` and `OTP_DEV_LOG=true`. `/dev/otp` is mapped and codes are stashed; the stub SMS channel logs them and nothing else is sent.
- The PWA is built with `pnpm --filter web build`, Vite's production mode. `devOtpToastEnabled()` was `import.meta.env.DEV && MODE !== 'test'`, which is false at build time, so the toast path is compiled out. Verified live: 0 bundle files contain `dev/otp`.

## Fix
- AC1. A build-time opt-in, `VITE_DEV_OTP_TOAST=true`, enables the toast in a production build. Without it, the default production bundle still carries no dev path (`check-dev-only.mjs` stays green).
- AC2. Regression test: with DEV false and the flag `true`, the hook fetches and shows the code; with DEV false and no flag it stays silent.
- AC3. The server's deploy script builds the PWA with the flag. Pushed and deployed with the owner's go-ahead.

## Known risk (stated to the owner)
The server's `/dev/otp` is public: anyone can read any phone's code for 2 minutes. That's acceptable only while the server is a demo with no SMS provider. Revisit before real residents use it.
