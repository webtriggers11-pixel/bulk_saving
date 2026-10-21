# FEAT-029 — A proper installable PWA

**Owner request (2026-10-21):** "make this as prper pwa app"

## What exists (FEAT-008, FEAT-016, FEAT-020; ADR-0015, ADR-0032)
vite-plugin-pwa with an auto-updating service worker that precaches the shell; an update prompt; an offline banner with read-only offline pages; push notifications; an install row on Profile (with a fallback hint for iOS); safe-area insets; `apple-mobile-web-app-capable`.

## What's missing (audited 2026-10-21)
1. **The app icon is a placeholder.** `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png` and `favicon.png` are a flat teal square with no mark. The same 512 file doubles as the maskable icon. The push icons carry the real mark (a white bolt on a dark rounded tile, `push/icon-mono.png`).
2. **The manifest is thin, and its colours are stale.** `theme_color #0f766e` and `background_color #ffffff` predate the Mono look (ground `#fafafa` / `#0a0a0a`). There is no `id`, `orientation`, `categories`, `shortcuts`, `screenshots` or `launch_handler`. The short name is the run-together "BulkSaving".
3. **iOS:** no `apple-mobile-web-app-title`, so the home-screen label is taken from `<title>`. No launch (splash) images, so iOS shows a white screen on launch.
4. **Offline first visit:** Google Fonts aren't cached, so an installed app opened offline falls back to system fonts.
5. **Install is hard to find.** It only lives under Profile, so a resident has to go looking for it.

## Acceptance criteria
- AC1. One source SVG mark produces every icon: `any` icons at 192/512 (rounded tile), `maskable` icons at 192/512 (full-bleed ground, mark inside the 80% safe zone), apple-touch-icon 180 (opaque, full-bleed), favicon 32/64 plus an SVG favicon, and shortcut icons at 96. A test checks each file's existence and real pixel size, and that the maskable and `any` icons are different files.
- AC2. The manifest has `id`, `name` "Bulk Saving", `short_name` "Bulk Saving" (12 characters or fewer), a description, `start_url`/`scope` `/`, `display` standalone, `orientation` portrait, `theme_color`/`background_color` equal to the Mono light ground (pinned to theme.css by test), `categories`, `lang` en-IN, `launch_handler` navigate-existing, three `shortcuts` (Group buys `/rounds`, Services `/services`, My requests `/my-requests`) with icons, and `screenshots` (at least one narrow and one wide, `form_factor` set) of the real app.
- AC3. iOS: `apple-mobile-web-app-title` "Bulk Saving", apple-touch-icon 180, and `apple-touch-startup-image` launch images in the Mono ground with the mark for current iPhone portrait sizes. A test checks that each `<link>` points at an existing file of the stated size.
- AC4. The service worker caches Google Fonts at runtime: the CSS stale-while-revalidate, the font files cache-first for one year. No API response is cached (ADR-0015 stands; a test asserts the runtime rules match only the two font hosts).
- AC5. Home shows a dismissible "Install the app" card when the app is not running standalone and is installable: Chromium's prompt is held, or the browser is iOS Safari (Share-sheet steps). It has one button, and the dismissal is remembered on the device (storage failure means it shows again; it never throws). It is never shown when standalone. Profile keeps its row.
- AC7 (found in T3). The service worker registers on every route, not only inside the resident AppShell, so the sign-in page and /admin get the offline shell and push too.
- AC6. Nothing regresses: the update prompt, push, offline pages, the dev-only bundle guard, and the class-token check.
