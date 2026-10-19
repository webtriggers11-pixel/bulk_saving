# ADR-0031: One Vercel look; colour is an accent pair; micro-interactions are named CSS

**Status:** Accepted · **Date:** 2026-10-19 · **Deciders:** Vivek ("I want the Vercel theme
type … multiple colour combinations … micro-interaction … sparks"), agent · **Work item:**
FEAT-019 · **Amends:** ADR-0029 (its revisit trigger fired), ADR-0021 (palettes)

## Confidence

**Level:** High (mechanism, contrast — tested per accent per scheme) · Medium (how much
motion residents enjoy before it is noise — unmeasured)

## Research depth

**Quick check** — `@property` (registered custom properties, needed to animate the beam's
conic angle) is in Chromium, Safari 16.4+, Firefox 128+; elsewhere the beam is static.

## Decisions

1. **Look and colour are separate attributes.** `data-look="vercel"` carries geometry and
   surfaces (FEAT-017's section, re-keyed with identical specificity); `data-theme="mono"`
   is the neutral base; `data-accent` is the colour. Picking a colour can no longer change
   the look — the defect the owner hit with FEAT-017.
2. **An accent is a PAIR**: `--brand` + `--brand-2` (its gradient partner) plus deep/light/ink,
   by day and by night. Day fills are deep enough for white text; night fills are light and
   carry Mono's near-black `--on-fill`. Text never sits on `--brand-2` alone.
3. **The glass palettes are retired from the UI**, not deleted: stored teal/indigo/ember
   migrate to lagoon/aurora/sunset. Their CSS stays dormant (no-JS fallback only); removing
   it is a CHORE if wanted.
4. **Micro-interactions are named classes in theme.css** (spotlight via `--mx/--my`,
   `border-beam`, `animate-twinkle` Sparkles, `ink-shimmer`, `animate-press-spark`), each
   stopped by the reduced-motion block; the JS-driven ones (press sparks, confetti) also
   check the preference before rendering. Nothing moves layout; markup at rest is unchanged.

## Alternatives rejected

- Seven full palettes each with its own tinted neutrals: 7× the tokens for a difference the
  Vercel register deliberately avoids (neutral grey ground, colour only as accent).
- A motion library (framer-motion): a dependency for effects that are a few keyframes.

## Revisit triggers

- Residents report the motion as distracting → drop the beam and shimmer first.
- The owner wants the glass look back as an option → it becomes `data-look="glass"`.
