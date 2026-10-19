# ADR-0029: A Vercel-style "Mono" look is a fourth palette, with geometry and type as tokens

**Status:** Accepted · **Date:** 2026-10-19 · **Deciders:** Vivek ("UI/UX like Vercel
components … cool in dark and white mode"), agent · **Work item:** FEAT-017

## Confidence

**Level:** High (mechanism — it is ADR-0021's "a fourth palette is a CSS block") ·
Medium (the visual result, until seen on a real phone)

## Research depth

**Quick check** — Geist and Geist Mono are on Google Fonts (OFL), so they load the same
way Plus Jakarta Sans does; Vercel's Geist colour scale (gray-1000 #171717, gray-900 #666,
background #fafafa / #0a0a0a, hairline ≈ 8% alpha) used as the reference values.

## Decisions

1. **`mono` is a palette** (`data-theme="mono"`), multiplied with day/night like the others
   (ADR-0028). Components do not know it exists; markup stays byte-identical.
2. **Radii and the sans family become CSS variables** (`--radius-chip … --radius-sheet`,
   `--font-sans`), declared once with today's values. Mono redeclares them (6/8/8/10/12/16,
   Geist). A palette may now change geometry and type, not just colour — the only way a
   Vercel look is possible without per-component branching.
3. **Mono's look is overrides of the system classes**, scoped `html[data-theme='mono'] .x`.
   Attribute + class outranks the base class and any single Tailwind utility, so the
   override wins without `!important` and without touching components.
4. **`on-fill` replaces literal `white` on accent fills** (amends ADR-0028 §2). Mono's night
   fill is near-white, so its text must be dark; in the tinted palettes `on-fill` is still
   white, so they render as before. `white` remains only on the switch knob.
5. **Mono is the default for a device with no stored palette.** The CSS fallback on `:root`
   stays teal (no-JS only — the pre-paint script always sets `data-theme`).

## Alternatives rejected

- A separate "style" attribute (`data-look`) orthogonal to palette: 4 × 3 × 2 combinations
  of which most are incoherent (a teal Vercel; a glass monochrome). One palette is simpler.
- Rewriting primitives in a second, Vercel-only set: duplicates every component and breaks
  the one-owner-per-shape rule (ADR-0022).
- A component library (shadcn CLI, Geist UI): dependencies, and ADR-0008 already chose
  hand-rolled primitives.

## Revisit triggers

- The owner wants Mono's geometry with colour → split geometry into its own attribute.
- Geist failing offline matters → self-host fonts (needs dependency approval; ADR-0021).
