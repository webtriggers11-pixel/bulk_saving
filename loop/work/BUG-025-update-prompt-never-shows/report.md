# BUG-025: the update prompt can never appear; every deploy reloads the page

**Found by:** FEAT-029 V2 (code-reviewer subagent), 2026-10-21 · **Severity:** P1

## Observed
`vite.config.ts` sets `registerType: 'autoUpdate'`. vite-plugin-pwa then builds the worker with `skipWaiting` and `clientsClaim`. Its client (`vite-plugin-pwa/dist/client/build/register.js`) reloads the page on `activated` with `isUpdate` and never calls `onNeedRefresh`. So `needRefresh` is always false, and UpdatePrompt (FEAT-008 AC9: "never refreshed out from under a half-filled pledge form") never shows. Instead the page reloads itself on every deploy. Since FEAT-029 registers at the root, that now also hits a half-typed OTP on sign-in and the admin new-round form.

`UpdatePrompt.test.tsx` passed only because the stub forces `needRefresh: true`, a state the real configuration never produces.

## Expected
A new build waits. Inside the app shell the resident sees "A new version is ready", and Reload activates it. On sign-in and admin the waiting worker takes over at the next launch.

## Failing test first
`src/pwa/pwa.test.ts`: the registration mode is `'prompt'`, and the built worker config doesn't skip waiting. The config moves into `src/pwa/config.ts`, so the test reads what the build uses rather than a regex over vite.config.ts (V2 P2).

## Fix
`registerType: 'prompt'`, exported from `src/pwa/config.ts` together with the runtime-caching rules.
