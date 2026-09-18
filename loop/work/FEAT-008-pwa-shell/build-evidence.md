# FEAT-008 T9 — AC3 and AC8 evidence

AC3 (mobile-first) and AC8 (shell loads offline) are the two criteria a Vitest
suite cannot prove; recorded here instead. E2E is deferred for v1 (STACK.md), so
AC8 is asserted against the generated service worker, NOT a real offline browser.
That gap is stated in spec.md and is the honest limit of this evidence.

## AC8 — the shell is precached and the SPA has an offline fallback

`pnpm --filter web build` (2026-09-18), `vite-plugin-pwa` 0.21.2, `generateSW`:

```
precache  9 entries (377.36 KiB)
  index.html
  assets/index-CgTXQn6q.js
  assets/index-DKSK6qvM.css
  assets/workbox-window.prod.es5-BBnX5xw4.js
  manifest.webmanifest
  favicon.png · apple-touch-icon.png · pwa-192x192.png · pwa-512x512.png
navigateFallback: index.html      (createHandlerBoundToURL("index.html"))
runtime caching of API responses: NONE  ← ADR-0015, checked for and absent
```

Every asset the app needs to render its shell is precached, and any navigation
resolves to `index.html` from the cache, so an installed app opens with the
network off. The absence of runtime caching is asserted too: it is a decision
(ADR-0015), so a future "helpful" addition should have to argue with this file.

`workbox-window` appears in the bundle because the update prompt (AC9) imports
`virtual:pwa-register/react`. It was already in `pnpm-lock.yaml` as
vite-plugin-pwa's peer; only the declaration in `apps/web/package.json` was
missing (`pnpm install`: "downloaded 0, added 0"). **Owner approved the
declaration on 2026-09-18** — CLAUDE.md requires asking before any dependency.

## AC3 — mobile-first layout

By inspection of the layout classes (no viewport in jsdom, so this is not a
test):

- Every page body is `mx-auto max-w-md` with `p-6`; no fixed pixel widths and no
  `min-w-` on content, so nothing forces horizontal scroll at 360 px.
- `BottomNav` is `fixed inset-x-0 bottom-0`, each tab `min-h-11 min-w-11`
  (44 px — the accepted minimum touch target), asserted in `BottomNav.test.tsx`.
- The bar adds `pb-[env(safe-area-inset-bottom)]` and `AppShell` pads its content
  `pb-20`, so the last card clears the fixed bar and the bar clears the iOS home
  indicator. Both asserted in `AppShell.test.tsx`.

## Gate

`bash scripts/verify.sh` → exit 0: backend 287 tests / 22 suites, web 103 tests /
26 files.

## A gap worth naming

`scripts/verify.sh` runs lint, typecheck and tests — **not** `pnpm -r build`. The
`workbox-window` resolution failure broke `pnpm --filter web build` while
verify.sh stayed green, so the one gate the process trusts would not have caught
a broken production build. Framework invariant 3 says "a build is not a test",
which is true and is not the point: a build that fails is still a broken deploy.
Worth a CHORE to add `pnpm -r build` to verify.sh — raised, not taken, because
changing the gate is the owner's call.
