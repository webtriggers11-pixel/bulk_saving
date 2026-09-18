# DESIGN-SYSTEM.md — the resident UI system

> The visual contract for the resident PWA. Decided in **ADR-0021**, built in
> **FEAT-011**. The drawn source of truth is the 14-artboard canvas stored in
> `loop/work/FEAT-011-resident-ui-redesign/design/` (canvas: https://claude.ai/artifact/BbGhsSzNC47hds97Bg5gLe).
>
> One rule governs everything below: **a component never invents a value.** If a
> colour, radius, shadow or duration is not in this file, it does not go in a `className`.

## Where it lives

| Thing | File |
|---|---|
| Tokens, palettes, surfaces, keyframes | `apps/web/src/styles/theme.css` |
| Tokens → Tailwind utilities | `apps/web/tailwind.config.js` |
| Primitives (Button, Card, Input, Label, Badge, Toast, Skeleton, Icon) | `apps/web/src/components/ui/` |
| The contract, as tests | `apps/web/src/styles/theme.test.ts`, `design-system.test.tsx` |
| The artboards | `loop/work/FEAT-011-resident-ui-redesign/design/*.dc.html` |

## Themes

Three palettes, one geometry. The palette is **one attribute on `<html>`**:

```html
<html data-theme="teal">   <!-- default -->
<html data-theme="indigo">
<html data-theme="ember">
```

Nothing in the component tree knows which is active — a test asserts the rendered
markup is byte-identical under all three. Adding a fourth palette is a CSS block in
`theme.css`; it needs no component change, and the test suite will tell you if you
miss a token.

State hues (error red, delivered green, offline amber, booked blue, the rating star)
deliberately **do not** move with the palette. They are meanings, not decoration.

## Colour tokens

Channels are stored as space-separated RGB (`--brand: 15 118 110`) so one variable
serves `bg-brand` and `bg-brand/20` alike.

| Token | Utility | Used for |
|---|---|---|
| `--brand`, `--brand-deep`, `--brand-light`, `--brand-ink` | `bg-brand`, `text-brand-ink`, … | primary actions, gradients, progress, glow |
| `--ink`, `--ink-muted`, `--ink-soft` | `text-ink`, `text-ink-muted`, `text-ink-soft` | the three text weights |
| `--ground`, `--ground-top` | `bg-ground` | the app ground (set on `html`) |
| `--mesh-1/2/3` | `bg-mesh-1` … | the three ambient washes behind the glass |
| `--shadow-rgb` | `shade` (`bg-shade/12`, every `shadow-*`) | every shadow and hairline, tinted per palette |
| `--state-*`, `--star` | `text-danger-ink`, `text-success-ink`, `text-amber-ink`, `text-info-ink`, `text-star` | meanings |

## Surfaces — the bento rhythm

Four ranked surfaces. **Emphasis comes from mixing them, never from inventing a new
card.** One accent surface per screen, at most.

| Class | What it is | When |
|---|---|---|
| `surface-glass` | blur 26, white 90→62%, white hairline, tinted float | the lead card on a screen |
| `surface-solid` | blur 18, white 96→80% | ordinary cards, list rows |
| `surface-tint` | brand-light 22% → brand 8% | grouping a related fact |
| `surface-accent` | radial + 142° brand gradient, white text | the one primary action |
| `surface-inset` | white 74→44% | blocks nested inside a card |

Glass is capped at three blurred surfaces per screen and every one keeps a ≥60%
white base, so an unsupported `backdrop-filter` degrades to a flat card.

## Type

Plus Jakarta Sans (CDN link in `index.html`; system sans fallback offline — see
ADR-0021). Money and counts always take `.num` (tabular figures).

`text-hero` 48 · `text-amount` 34 · `text-display` 26 · `text-headline` 21 ·
`text-title` 19 · `text-lead` 15 · `text-body` 14 · `text-caption` 13 ·
`text-meta` 12.5 · `text-micro` 11.5 · `text-label` 11.5 caps · `text-eyebrow` 10.5 caps

## Radius, elevation, spacing

- **Radius:** `rounded-chip` 12 · `rounded-control` 16 · `rounded-inset` 18 ·
  `rounded-tile` 20 · `rounded-card` 24 · `rounded-sheet` 34. Nothing in between.
- **Elevation:** `shadow-hairline` → `shadow-lift` → `shadow-float` → `shadow-deep`,
  plus `shadow-accent` / `shadow-control` / `shadow-field` / `shadow-ring` /
  `shadow-focus`. All tinted with `--shadow-rgb`, never black.
- **Touch floor:** `h-touch` 44 (the minimum), `h-control` 50 (buttons),
  `h-icon` 48 (icon buttons), `min-h-tab` 58 (tab items). Asserted by test.

## Motion

| Interaction | Timing |
|---|---|
| Press | 120ms, scale .975 (`press`, `ripple`) |
| Hover lift | 340ms `ease-out-soft`, −2 to −3px (`t`, `card-hover`) |
| Focus ring | 280ms, 0 → 5px at 17% (`focus:shadow-ring`) |
| Entrance | 780ms `ease-entrance`, 80ms stagger (`animate-rise`, `.stagger`) |
| Button sheen | 850ms, one pass on hover (`sweep`) |
| Progress shimmer / skeleton sweep | 2.6s / 1.7s loops (`bar-fill`, `skeleton`) |
| Live pulse | 2.4–2.6s (`animate-pulse-ring`) |
| Ambient drift | 19–27s (`animate-drift-a/b/c`) |

**Everything collapses under `prefers-reduced-motion: reduce`** — one media query in
`theme.css`, and a test forbids inline `animation` styles that would escape it.
`useCountUp` goes further: if motion preference cannot be read at all, it does not
animate.

## Skeletons

A skeleton is the **shape of what is coming**, not a spinner: each screen has its own
(`HomeSkeleton`, `CatalogSkeleton`, `RoundsSkeleton`, `RequestsSkeleton`) mirroring
that screen's real geometry. `SkeletonScreen` carries `aria-busy` and keeps the
original "Loading …" sentence announced but undrawn.

## Icons

One family, in `components/ui/icon.tsx`: 24-box, 1.8 stroke, round caps, `currentColor`,
`aria-hidden`. No emoji, no second set. An icon-only control carries the `aria-label`.

## Adding to the system

1. Need a new value? Add the **token** (`theme.css`) and its **utility**
   (`tailwind.config.js`) — then use the utility.
2. Need a new surface or motion? Add it as a named class in `theme.css` beside its
   family, so it is disabled with the rest under reduced motion.
3. Run `bash scripts/verify.sh`. `design-system.test.tsx` fails the build on a
   hard-coded colour, a missing palette token, a contrast regression, a control under
   44px, or a component that branches on the theme.
