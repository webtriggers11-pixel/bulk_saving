# ADR-0041: A proper installable PWA: one-SVG icon set, a full manifest, font runtime caching, an install card on Home

**Status:** Accepted · **Date:** 2026-10-21 · **Deciders:** Vivek ("make this as prper pwa app", "web app"), agent · **Work item:** FEAT-029 · **Amends:** ADR-0015 (runtime caching scope)

## Confidence
**Level:** High. Every manifest member and icon is pinned by `src/pwa/pwa.test.ts`: file exists, real pixel size from the PNG header, maskable and apple-touch icons opaque, launch-image media queries equal to the device pixels.

## Research depth
**Quick check** of the manifest members (`id`, `launch_handler`, `shortcuts`, `screenshots.form_factor`), the maskable safe zone (an 80% circle), and the iOS `apple-touch-startup-image` media queries (device CSS size × DPR, portrait).

## Context
FEAT-008 made the app installable in principle, but its icon was a flat teal placeholder square, and the same file doubled as the maskable icon. The manifest used pre-Mono colours and had no id, shortcuts or screenshots. iOS got no title or launch images. Fonts went missing offline. The install control lived only under Profile.

## Decisions
1. **One source mark, `apps/web/pwa-assets/mark.svg`** (the app's own bolt). `scripts/gen-pwa-assets.mjs` renders every PNG: `any` 192/512 (rounded tile), `maskable` 192/512 (full bleed, mark at 42%), apple-touch 180 (opaque), favicons 32/64 + SVG, shortcut icons 96, and iOS launch images for the iPhone sizes in `src/pwa/launch-images.ts`. The outputs are committed. The script uses `sharp` from the lockfile (Astro's optional dependency), resolved through Astro: **no new dependency**. If Astro ever drops sharp, only regeneration breaks.
2. **The manifest is `src/pwa/manifest.ts`,** typed `satisfies Partial<ManifestOptions>`. The build and the tests read the same object. Colours are the Mono light ground, pinned to theme.css. It has three shortcuts (Group buys, Services, My requests) and three screenshots captured from the real app with seeded demo data.
3. **Runtime caching: Google Fonts only.** CSS uses stale-while-revalidate; font files are cache-first for one year. ADR-0015's rule stands: no API response is cached, and a test asserts the only two origins. Splash images and screenshots are served, not precached.
4. **The install card on Home** (`InstallCard`) appears while not standalone and installable: Chromium's held prompt, or iOS Safari's Share-sheet steps. "Not now" is remembered per device in localStorage, and storage failure means it simply shows again. Profile keeps its row.

## Consequences
Good: a real icon on every launcher, a branded launch screen on iOS, the richer install sheet on Android and desktop Chrome, shortcuts on long-press, and fonts offline.
Bad: about 0.7 MB of PNGs in `public/` (served on demand; only the icons are precached). Screenshots go stale as the UI changes; re-capture when Home changes visibly. An already-installed copy picks up the new icon only on the browser's own manifest-update cycle.

## Revisit trigger
If the brand mark changes, edit `mark.svg` and re-run the script. If the precache grows past about 2 MB, revisit `includeAssets`.
