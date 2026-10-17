# ADR-0028: Light/dark schemes orthogonal to palettes; a `paper` token; one Sheet primitive

**Status:** Accepted · **Date:** 2026-10-18 · **Deciders:** Vivek ("dark mode light mode
similar to telegram … sheets … premium phone app look"), agent · **Work item:** FEAT-016

## Confidence

**Level:** High (mechanism) · Medium (night colours, until seen on a real phone)

## Research depth

**Quick check** — View Transitions are in Chromium and Safari 18+; Firefox falls back to an
instant switch, which is the designed fallback anyway.

## Decisions

1. **Scheme is a second attribute, `data-scheme`, not a fourth palette.** Palettes (teal,
   indigo, ember) and schemes (light, dark) multiply: 3 × 2 token sets, one geometry. The
   "byte-identical markup under every palette" test extends to every scheme.
2. **`paper`** — the colour a light surface is made of: white by day, the palette's
   night surface by night. Overlays on glass/solid surfaces use it. **`white` stays white**
   and is allowed only on brand/accent fills (primary button, lead stat, hero card, the
   monogram), where it must not darken. A test pins which files may use `white`.
3. **Preference light / dark / system**, stored per device (localStorage, try/catch,
   renders correctly without it), applied by an inline script in index.html before first
   paint, then owned by `lib/scheme.ts`. "System" listens to `prefers-color-scheme` live.
4. **The switch animates with View Transitions**: `document.startViewTransition` + a
   clip-path circle on `::view-transition-new(root)` from the control's centre. No library.
   Under reduced motion, or where unsupported, the scheme changes instantly.
5. **One `Sheet` primitive** (bottom sheet on phones, centred on wide screens) built on a
   `role="dialog" aria-modal` panel with its own focus trap — no dependency. Drag-to-dismiss
   uses pointer events on the grabber/header only, so content still scrolls.

## Alternatives rejected

- `prefers-color-scheme` only (no in-app choice): the owner asked for a switch.
- Inverting the day palette with `filter: invert`: wrecks images, shadows and brand hues.
- A sheet library (vaul, react-modal-sheet): a dependency for ~150 lines we control and test.

## Revisit triggers

- Colours read wrong on a real OLED phone → tune the night ground/glass values.
- Firefox gains View Transitions → nothing to do; it starts animating.
