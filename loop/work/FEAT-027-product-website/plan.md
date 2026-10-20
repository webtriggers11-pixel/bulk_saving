# Plan FEAT-027 — Product website (`apps/site`)

**Derived from:** spec.md · **Approved by:** agent (autonomous, owner's standing direction) on 2026-10-20

## Technical approach

- `apps/site`: Astro 7, `output: 'static'`, no framework integration (Astro components + vanilla
  TS islands via `<script>`). One page `src/pages/index.astro` composed of section components in
  `src/components/`. Content in `src/content/features.ts` (typed, derived from FEATURES.md).
- Tokens: `src/styles/tokens.css` — a verbatim subset of `apps/web/src/styles/theme.css` (mono
  palette day/night, seven accents day/night, Vercel radii/fonts/hairlines). `tokens.test.ts`
  parses both with one small regex parser and compares block by block (ADR-0038 §2).
- Theme attributes and pre-paint script mirror `apps/web/index.html` (same localStorage keys, so a
  resident who opens the site on the same origin as the app gets their colour; otherwise defaults).
- 3D: `src/scene/model.ts` (pure: tiers, price for units, which windows light, spark on unlock),
  `src/scene/building.ts` (Three.js: BoxGeometry tower, `EdgesGeometry` ink lines, window planes
  with emissive accent, idle rotation + pointer parallax, `ResizeObserver`, pause when off-screen,
  reduced-motion static). Loaded with a dynamic `import()` from the hero island when the canvas is
  in view; `src/scene/fallback.svg` inline for no-WebGL.
- Tests: Vitest with `getViteConfig` from `astro/config`; the page test uses
  `experimental_AstroContainer` to render `index.astro` to a string and asserts with regex/`node-html-parser`-free
  string checks (no jsdom dependency).
- Lint/typecheck: ESLint (same flat config as web, `src/**/*.ts`), `astro check` for `.astro` + TS.
- CI: `node-version: 24` in `.github/workflows/verify.yml` (STACK.md already says Node 24).

## Data model / contracts

No backend. `features.ts` shape: `{ id: 'FEAT-NNN', title, what, how, why, section, status:
'done' | 'coming-soon' }` plus `sections: { id, title, question }[]`. The registry is the oracle
the content test reads.

## New decisions required

ADR-0038 — Astro static site in `apps/site`; tokens copied and pinned by test, not imported
(Confidence High on the mechanism, Medium on Astro 7 API stability for the container test; Research
depth: quick check of Astro 7 docs/types after install).

## Risks

- Astro 7 container API shape differs from 5 → read `node_modules/astro` types before writing the test.
- Three.js bundle weight → lazy import, one scene, verify the built chunk size in the LOG.
- `pnpm -r build` order: the site depends on nothing in the workspace; no ordering risk.
- CHORE-021 segfault may hit any gate run; rerun.
