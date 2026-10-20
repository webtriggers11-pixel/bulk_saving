# ADR-0039: The product website is an Astro static site in `apps/site`; it shares the app's TOKENS (pinned by a test), not its components

**Status:** Accepted · **Date:** 2026-10-20 · **Deciders:** Vivek ("create new folder in apps
using astro … beautiful product website … 3d animation … same theme consistency, SPA is fine"),
agent · **Work item:** FEAT-028 · **Builds on:** ADR-0029 (Mono look), ADR-0031 (accent pairs)

## Confidence

**Level:** High (mechanism: static HTML, a copied token sheet, a parser test that fails on drift)
· Medium (Astro 7's `experimental_AstroContainer` is still prefixed experimental; the page test
depends on it)

## Research depth

**Quick check** — Astro 7.4.1 (engines node ≥ 22.22; the repo runs 24), `astro/container`
`renderToString`, `getViteConfig` for Vitest; Three.js 0.186 ESM tree-shakes; `@types/three`
matches.

## Decisions

1. **A third layer, `apps/site`, on Astro, static output, one page.** The owner named Astro;
   a marketing page has no server state, so static HTML with vanilla TS islands is the smallest
   thing. No React integration: the site shares nothing at runtime with `apps/web`.
2. **Theme consistency is a copied token sheet pinned by a test, not an import.** `apps/site/src/
   styles/tokens.css` repeats the Mono palette (day/night), the seven accent pairs (day/night) and
   the Vercel geometry/type/hairline tokens verbatim; `tokens.test.ts` parses both files and fails
   if any (selector, variable) pair differs. Importing `apps/web`'s 1,300-line theme would drag the
   app's component classes into the site and couple the two builds; a copy with a drift test keeps
   each build independent and the contract explicit. Same `<html>` attributes and the same
   `localStorage` keys (`bulk:scheme`, `bulk:palette`) as the app's pre-paint script.
3. **Content is pinned to the registry.** `features.ts` is the site's copy of FEATURES.md; a test
   reads `loop/REGISTRY.md` and fails if a `done` FEAT is missing from the page, an unknown ID is
   named, or a "coming soon" item is actually done. The site can never sell what is not shipped.
4. **One 3D scene, lazy, with a static fallback.** Three.js only in the hero, imported on demand
   when the canvas is in view; a static SVG building otherwise (no WebGL, reduced motion keeps the
   scene but stops idle motion and sparks). The tier/lighting arithmetic is a pure module with
   unit tests; the renderer reads colours from the CSS tokens so the scene follows accent and scheme.
5. **Dependencies added** (autonomous, per the owner's standing direction): `astro`, `@astrojs/check`,
   `three`, `@types/three`; the lint/test toolchain matches `apps/web` (eslint 9, typescript-eslint,
   vitest 3).

## Alternatives rejected

- A page inside `apps/web` (React route): the PWA is gated by an invite code and ships a service
  worker and app chunks a visitor never needs.
- Importing `theme.css` from the site: couples builds, pulls app classes, and the gate's class
  checker would start scanning a second app.
- A CSS-only "3D" (transforms): cannot light windows per unit or burst sparks convincingly; the
  owner asked for 3D.
- React Three Fiber: adds React + a reconciler for one scene.

## Revisit triggers

- Astro's container API changes or graduates → update the page test; if it is removed, render
  the built `dist/index.html` instead.
- A second page or a blog is wanted → Astro content collections; still static.
- The token sheet drifts more than twice in a month → generate it from the app's file at build.
