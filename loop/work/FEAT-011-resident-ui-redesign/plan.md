# Plan FEAT-011 — Resident UI redesign

**Decisions:** ADR-0021 (token layer + themes), ADR-0008 stands (hand-rolled primitives).

## Shape of the change

One new layer, no new architecture:

```
apps/web/src/
  styles/theme.css        NEW  — @layer base: the token contract + 3 palettes + motion keyframes
  index.css                    — imports theme.css, keeps the tailwind directives
  components/ui/*              — primitives consume tokens via semantic Tailwind utilities
  components/ui/icon.tsx  NEW  — the one stroke-icon family (kills emoji + ad-hoc nav paths)
  components/ui/skeleton.tsx NEW — the shimmer primitive
  features/*/                  — screens re-laid-out; *.skeleton.tsx beside each screen
tailwind.config.js             — theme.extend maps tokens to utilities (bg-surface, rounded-card…)
index.html                     — the webfont link
```

Nothing moves between layers; no file leaves `apps/web`; the backend and `@bulk/shared` are
untouched.

## Why a CSS-variable layer under Tailwind (not Tailwind alone)

Tailwind can hold a palette in `theme.extend`, but a compiled `bg-brand-600` cannot change at
runtime — and AC3 needs `data-theme` to re-tint a rendered tree. So the values live in CSS
custom properties on `[data-theme]`, and Tailwind's config maps utilities onto
`rgb(var(--brand) / <alpha-value>)`. Components keep writing ordinary utilities
(`bg-brand text-ink rounded-card shadow-lift`); the palette swap is one attribute. ADR-0021
records the trade-off.

## Order of work, and why

1. **Tokens first** (T1). Everything downstream references them; doing screens first would
   bake literals in and need a second pass.
2. **Primitives before screens** (T2–T4). Button/Card/Input/Badge/Icon/Skeleton are used by
   every screen; restyling them moves most of the surface before a single screen is touched.
3. **Shell before screens** (T5). AppShell owns the ground and the tab bar that every screen
   sits inside.
4. **Screens one at a time** (T6–T11), each its own commit and its own gate run, so a
   regression is bisectable to one screen.
5. **Verification** (T12–T14): the new tests AC3/AC5 demand, then V2 by an independent
   reviewer, then V3's double gate run.

## Test strategy

Framework invariant 3 — a build is not a test. Every task lands with real assertions:

- **Tokens**: a test mounts a tree under each `data-theme` and asserts the resolved custom
  properties differ and the class names do NOT (AC3 = re-tint without layout change).
- **Primitives**: existing render/behaviour tests keep passing; variant tests assert the
  variant class is applied, not the hex.
- **Skeletons**: each screen test asserts the skeleton is present while the query is loading
  and gone once data lands, and that `aria-busy`/the visually-hidden "Loading …" label is
  still exposed (AC4 — the current tests' intent survives).
- **Motion**: a test asserts the reduced-motion media query is in the stylesheet and that no
  component sets an inline `animation`.
- Every existing resident test stays as-is unless it asserts a style literal; each such edit
  is called out in the task's commit message.

## Risks handled in-plan

- **Webfont offline.** The PWA must work offline; a Google-Fonts `<link>` will not. The stack
  falls back to system sans, so text renders either way. Self-hosting is an npm dependency
  (`@fontsource/*`) and needs owner approval per CLAUDE.md — flagged, not assumed.
- **`backdrop-filter` cost.** Capped at three blurred surfaces per screen; every glass surface
  keeps a ≥60% white base so an unsupported filter degrades to a flat card, not to unreadable.
- **Test churn.** Expected only where a test asserts a colour class. If a behavioural test
  fails, that is a defect in this item, not a test to edit.
