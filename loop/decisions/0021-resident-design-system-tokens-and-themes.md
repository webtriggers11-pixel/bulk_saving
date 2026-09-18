# ADR-0021: The resident UI is a token layer in CSS custom properties, themed by `data-theme`

**Status:** Accepted
**Date:** 2026-09-19 · **Deciders:** Vivek (approved the design; "use this exact same design"), agent · **Work item:** FEAT-011

## Confidence

**Level:** High (that tokens belong in CSS custom properties rather than only in the Tailwind
config) · Medium (on the webfont delivery choice, below)
**Basis:** The requirement that decides it is AC3 — `data-theme` must re-tint a *rendered*
tree. Tailwind compiles `bg-teal-700` to a literal at build time, so a palette held only in
`tailwind.config.js` cannot switch at runtime without shipping three class sets and swapping
them on every element. Custom properties switch by inheritance, which is what a theme is.
Medium on fonts because the offline consequence is real and the alternative needs approval.

## Research depth

**Judgment call**, grounded in the repo: the existing primitives (ADR-0008), the 40+ sites
that hard-code `teal-*`/`slate-*`, and the PWA's offline contract (ADR-0015). Verified against
Tailwind 3.4's documented `<alpha-value>` mechanism, which is what lets one variable serve
both `bg-brand` and `bg-brand/20`. No external research.

## Context

Every colour, radius and shadow in the resident app is chosen per component. The owner
approved a design (14 artboards, stored in `loop/work/FEAT-011-resident-ui-redesign/design/`)
that is explicitly themeable: three palettes, one geometry. Implementing it as more utility
classes would reproduce the problem it exists to fix.

## Decision

1. **Tokens are CSS custom properties**, declared once in `apps/web/src/styles/theme.css` and
   redeclared per palette under `[data-theme="indigo"]` / `[data-theme="ember"]`. Colour
   channels are stored **space-separated RGB** (`--brand: 15 118 110`) so Tailwind's
   `rgb(var(--brand) / <alpha-value>)` gives every utility its opacity variants for free.
2. **Tailwind maps tokens to semantic utilities** (`bg-surface`, `text-ink-muted`,
   `rounded-card`, `shadow-float`, `blur-glass`). Components never write a hex, an `rgba()`
   or a `teal-*`/`slate-*` class. This keeps ADR-0008 intact — the primitives stay
   hand-rolled, they just stop inventing values.
3. **The palette is one attribute on `<html>`.** Nothing in the component tree knows which
   theme is active, so adding a fourth palette is a CSS block, and a per-user preference
   later is a store write — not a component change.
4. **Motion lives with the tokens**, as named keyframes plus duration/easing variables, and
   the whole layer is disabled inside one `@media (prefers-reduced-motion: reduce)` block.
   No component sets an inline `animation`.
5. **Admin keeps its current look for now.** The tokens are global, so admin inherits the
   ground and the primitives it shares, but its layouts are not part of this item.

## Consequences

- Positive: one place to change the look; runtime themes; no compiled colour duplication;
  every component reads as intent (`bg-surface`) rather than as a value (`bg-white`).
- Positive: the artboards are the contract — `design/*.dc.html` can be diffed against the
  implementation, which is why they are stored in the repo rather than left in the canvas.
- Negative: indirection. `bg-brand` no longer tells you the hex; you read `theme.css`.
  Mitigated by keeping the token list short and documented in `DESIGN-SYSTEM.md`.
- Negative: **the webfont (Plus Jakarta Sans) is loaded from Google Fonts by `<link>`**, so
  an offline first-visit falls back to the system sans stack. Self-hosting means adding
  `@fontsource/plus-jakarta-sans`, and CLAUDE.md requires owner approval for any dependency,
  so it is NOT taken here. The fallback stack is metric-compatible enough that layout does not
  shift; only the letterforms do.
- Negative: `backdrop-filter` is expensive on low-end Android. Capped at three blurred
  surfaces per screen, each over a ≥60% white base so it degrades to a flat card.
  Counted per screen at close: Home 3, everything else ≤2. The one exception is Home
  **while the offline banner is showing**, which makes 4 — transient, one screen, one
  small strip, and not worth a structural change. Blur deliberately does not scale
  with data: only the LEAD open round gets a glass card, or a resident in eight rounds
  would scroll eight blurred layers.
- Consequence discovered the hard way, and now a gate step: **a test that reads the
  source cannot verify a style.** Two classes shipped in this item that emitted no CSS
  at all while every unit test passed — a Tailwind namespace collision (`fill-brand`),
  then eleven off-scale alpha steps (`bg-amber-ink/12`). jsdom applies no CSS, so
  `scripts/check-css-classes.mjs` reads the BUILT stylesheet and asserts every class
  token in `apps/web` resolves to a rule. It runs in verify.sh between `build` and
  `test`.

## Revisit triggers

- The owner approves a dependency for self-hosted fonts → drop the CDN link, and the offline
  caveat disappears.
- A per-society or per-user theme becomes a real requirement → the switcher is a store value
  written to `<html data-theme>`; no token work should be needed. If it is, this ADR was wrong.
- Any measured jank on a mid-range Android device attributable to blur → drop glass to the
  tab bar only.

## Alternatives considered

- **Tailwind config only.** Simplest, and fails AC3: runtime theming would need three class
  sets or a rebuild.
- **CSS-in-JS / styled-components.** Runtime theming solved, but it is a dependency (approval)
  and it abandons the Tailwind+primitives stack the app already runs on (ADR-0008).
- **`shadcn/ui` CLI adoption now.** Tempting while touching every primitive, but it is a
  second migration riding on a redesign; it would make this diff unreviewable. STACK.md
  already keeps it as a later option.
