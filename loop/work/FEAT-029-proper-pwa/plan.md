# Plan FEAT-029 — A proper installable PWA

**Derived from:** spec.md · **Approved by:** autonomous loop (owner standing instruction) on 2026-10-21

## Technical approach
- **Icons (AC1, AC3):** `apps/web/pwa-assets/mark.svg` is the bolt, taken from the push icon. `apps/web/scripts/gen-pwa-assets.mjs` renders every PNG with `sharp`, which is already in the lockfile via Astro (resolved from `apps/site`). No new dependency, and the outputs are committed. It is re-run by hand when the mark changes. Tile: the Mono dark gradient (#0a0a0a → #404040) with a white bolt. Launch images: the light Mono ground (#fafafa) with the tile centred.
- **Manifest (AC2):** in `vite.config.ts`, with the values in one exported module (`apps/web/pwa.manifest.ts`) so tests read the same object the build uses. Screenshots come from the real app (dev login `1111`) through headless Chrome over CDP, using Node 22's built-in WebSocket. They are stored in `public/screenshots/`.
- **iOS (AC3):** `<link rel="apple-touch-startup-image" media=…>` for each iPhone size, plus the title meta.
- **Fonts (AC4):** `workbox.runtimeCaching` with two rules, `fonts.googleapis.com` (StaleWhileRevalidate) and `fonts.gstatic.com` (CacheFirst, 1 year, 30 entries, statuses 0/200).
- **Install card (AC5):** `features/shell/InstallCard.tsx`, built on `useInstallPrompt` plus a small `isIosSafari()`, with the dismissal in `localStorage['bulk:install-dismissed']` inside try/catch. It renders at the top of HomePage, uses the existing Card/Button primitives, and is tested with the stubbed event.

## Data model / contracts
None. Web only.

## New decisions required
ADR-0041: icons from one SVG via a script (committed outputs, no new dependency); runtime-cache Google Fonts (amends ADR-0015 §scope); a Home install card. Confidence High; Research depth: quick check (manifest members and maskable safe zone per MDN/web.dev; iOS launch-image media queries).

## Risks
- `sharp` is transitive: if Astro drops it, the script breaks but the committed PNGs don't. The ADR notes this.
- iOS launch images must match device pixels exactly, or iOS ignores them silently. The sizes come from Apple's device table, and a mismatch only means a white launch.
- Chrome caches the manifest: an installed copy picks up new icons on its own update cycle.
