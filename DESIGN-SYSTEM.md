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
| Screen primitives (PageHeader, EmptyState, FactTile, StatCard, Field, Monogram, DataRows, AmbientGround) | `apps/web/src/components/ui/` |
| The contract, as tests | `apps/web/src/styles/theme.test.ts`, `design-system.test.tsx` |
| The artboards | `loop/work/FEAT-011-resident-ui-redesign/design/*.dc.html` |

## Themes

Three tinted palettes share one geometry; Mono brings its own (below). The palette is **one attribute on `<html>`**:

```html
<html data-theme="teal">   <!-- default -->
<html data-theme="indigo">
<html data-theme="ember">
<html data-theme="mono">   <!-- FEAT-017: the app's default -->
```

Nothing in the component tree knows which is active — a test asserts the rendered
markup is byte-identical under all three. Adding a fourth palette is a CSS block in
`theme.css`; it needs no component change, and the test suite will tell you if you
miss a token.

State hues (error red, delivered green, offline amber, booked blue, the rating star)
deliberately **do not** move with the palette. They are meanings, not decoration.

### One look, seven accents (FEAT-019, ADR-0031) — supersedes the palette picker below

`<html data-look="vercel" data-theme="mono" data-accent="ocean">`: the **look** is always
Vercel (below); `mono` is its neutral base; the **accent** is a colour pair — `--brand` and
its gradient partner `--brand-2` (+ deep/light/ink) by day and by night.

| Accent | Pair | | Accent | Pair |
|---|---|---|---|---|
| Mono | black → grey | | Sunset | orange → pink |
| Ocean | blue → cyan | | Forest | green → teal |
| Aurora | violet → pink | | Lagoon | teal → cyan |
| Bloom | pink → violet | | | |

- Text sits on `brand`/`brand-deep` (≥4.5:1 with `on-fill`, tested per accent and scheme),
  never on `brand-2` alone; `brand-2` is for gradients (ring, ladder fill, accent glow, aurora).
- Utilities: `from-brand to-brand-2`, `fill-brand-2`, `bg-brand-2`.
- Retired glass palettes migrate: teal → lagoon, indigo → aurora, ember → sunset.

**Micro-interactions** (all named in `theme.css`, all off under reduced motion):
spotlight (Card writes `--mx/--my`; the look paints an accent disc), `border-beam` (a light
travelling the lead card's edge), `Sparkles` (three twinkling stars — `components/ui/sparkles.tsx`),
`ink-shimmer` (a light through a headline figure; both stops are ≥4.5:1 ink), press sparks
(primary `Button`, 8 sparks from the press point, rendered only while flying).

### Mono — the Vercel register (FEAT-017, ADR-0029) — the default

`data-theme="mono"` is a fourth palette that also carries **geometry and type**: flat
paper with 1px hairlines, 6/8/8/10/12/16px radii, Geist (600/700 weights) with Geist Mono
micro-labels, a faint fading grid instead of the mesh washes, an inverted accent card
(ink by day, near-white by night), and no sweep, sheen, halo or glow. Hover darkens the
hairline instead of lifting the card.

- It is CSS only: one `html[data-theme='mono'] .<system class>` section in `theme.css`
  overrides the surfaces and fills. Components never branch on it (AC3 test covers 4 palettes).
- Radii and the sans family are tokens (`--radius-*`, `--font-sans`, `--font-label`);
  the tinted palettes keep their original values, pinned by test.
- New devices start in Mono; a stored palette is kept. The CSS fallback on `:root` is still
  teal (only seen without JS).
- Hooks it uses beyond the surface classes: `.ambient-ground` (grid instead of washes) and
  `.card-wash` (decorative washes it hides).

### Day and night (FEAT-016, ADR-0028)

The scheme is a **second, orthogonal attribute**: `data-scheme="light|dark"`. Every
palette has a night — a charcoal tinted with that palette, never `#000` — and the same
token names; a test fails if a night is missing one, or if any ink drops under 4.5:1
on the ground or on `paper`, or if white on the brand fill does.

- The person picks **Light, Dark or Match phone** plus a palette in the Appearance
  sheet (Profile); `SchemeToggle` is the quick switch (Home, Profile, admin header).
  Both are remembered per device by `lib/appearance.ts`.
- `index.html` applies the stored choice — and the status-bar `theme-color` — before
  first paint. Its colour table is pinned to the `--ground` tokens by a test.
- Switching grows the new scheme as a circle from the control (View Transitions + a
  clip-path). Instant under reduced motion or where View Transitions are missing.

## Colour tokens

Channels are stored as space-separated RGB (`--brand: 15 118 110`) so one variable
serves `bg-brand` and `bg-brand/20` alike.

| Token | Utility | Used for |
|---|---|---|
| `--brand`, `--brand-deep`, `--brand-light`, `--brand-ink` | `bg-brand`, `text-brand-ink`, … | primary actions, gradients, progress, glow |
| `--ink`, `--ink-muted`, `--ink-soft` | `text-ink`, `text-ink-muted`, `text-ink-soft` | the three text weights |
| `--ground`, `--ground-top` | `bg-ground` | the app ground (set on `html`) |
| `--mesh-1/2/3` | `bg-mesh-1` … | the three ambient washes behind the glass |
| `--shadow-rgb` | `shade` (every `shadow-*`) | shadows only — black at night, so never a hairline |
| `--line` | `border-line/10`, `bg-line/20`, `stroke-line/15` | hairlines, dividers, tracks: the shadow tint by day, white at night |
| `--paper` | `bg-paper/60`, `border-paper/85`, … | what light surfaces are made of: white by day, the palette's night surface at night |
| `--edge-strong/--edge/--edge-soft`, `--sheen` | (full colours, used in `theme.css` and the `shadow-*` scale) | glass highlights and the button sheen — night needs a different alpha, not just a channel |
| `--on-fill` | `text-on-fill`, `bg-on-fill/20`, `border-on-fill/40` | text and marks on an accent fill — white in the tinted palettes, near-black on Mono's night fill |

**Marks on an accent fill use `on-fill`, not `white`** (FEAT-017): Mono's night fill is
near-white. Literal `white` is left only on the switch knob and the swatch tick. `design-system.test.tsx` counts every white
utility per allowlisted file — a new one anywhere is a decision the test makes you
write down.
| `--state-*`, `--star` | `text-danger-ink`, `text-success-ink`, `text-amber-ink`, `text-info-ink`, `text-star` | meanings |

## Surfaces — the bento rhythm

Four ranked surfaces. **Emphasis comes from mixing them, never from inventing a new
card.** One accent surface per screen, at most.

| Class | What it is | When |
|---|---|---|
| `surface-glass` | blur 26, white 90→62%, white hairline, tinted float | the lead card on a screen |
| `surface-solid` | white 97→86%, **no blur** | ordinary cards, list rows |
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
  `rounded-tile` 20 · `rounded-card` 24 · `rounded-sheet` 34 (Mono: 6 · 8 · 8 · 10 · 12 · 16).
  Tokens (`--radius-*`); nothing in between.
- **Micro-label:** `.term-label` — the 10px uppercase label over a value. A token,
  because four files had typed the same five classes.
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
| Sheet in / out | 460ms rise (`sheet-in`) / 240ms sink from wherever it is (`sheet-out`); centred pop on `md` |
| Sheet settle | 300ms spring home after a short drag (`sheet-settle`) |
| Scheme reveal | 520ms circle from the control (`lib/appearance.ts`) |
| Tab pill | 420ms slide with a slight overshoot (`tab-pill`) |
| Compact title bar | 220ms in (`compact-bar`) |
| Confetti | 1100ms, 16 pieces, once per saved pledge / tier reached (`animate-confetti`) |

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

## Screen primitives (CHORE-008, ADR-0022)

A screen is assembled from these, not drawn. `primitives.test.tsx` asserts one owner
per shape for the ones with a signature — `PageHeader`, `EmptyState`, `Fact`,
`Monogram`, `AmbientGround`, `StatCard`, `RowSurface`/`DataRows` and `Field`'s error
line. A signature is a tripwire, not a proof: it matches one exact class string, so a
copy that drops or reorders a class slips past it. Three did, and were found by review
rather than by the test (V2 P1-2).

| Primitive | Its one job |
|---|---|
| `PageHeader` | title, optional subtitle, optional action. Knows nothing about routes. |
| `EmptyState` | glyph, heading, line, optional way out. Never explains *why* it is empty. |
| `Fact` | one labelled fact. `variant`: `tile` · `row` · `plain`. Renders `<dt>/<dd>`, so the caller supplies the `<dl>`. |
| `StatCard` | one number and what it counts. `emphasis`: `lead` · `normal` · `quiet` · `alert`. Formats nothing. |
| `Field` | label + control + error, with the id/aria wiring. Control comes in as a render prop. |
| `Monogram` | initials on the brand gradient, with the halo. Derives initials in one place. |
| `DataRows` / `DataRow` / `DataCell` / `RowSurface` | a dense list of records; columns from `md`, stacked below. Not a table — see the exception in ADR-0022. |
| `AmbientGround` | the fixed, inert ground: three drifting washes plus grain. |
| `Sheet` | the "do one thing" surface: bottom sheet on a phone, centred panel on `md`. Dialog semantics, focus trap (tabbable only) and restore (`returnFocus` when the opener goes away), Escape/backdrop/drag to dismiss. **Always closable** — keep the draft in the caller, never block `onClose` on a pending save. |
| `SchemeToggle` | the sun/moon quick switch; reveals from its own centre. |
| `ConfirmSheet` | the question before a destructive action (FEAT-024): title, one line of consequence, a danger "Yes, …" and a ghost "Keep …". Built on `Sheet`, so it stacks and traps focus. The caller keeps the action and its pending/error state. |
| `PageHeader collapsible` | the large title shrinks into a blurred compact bar once scrolled past (title only — the action stays where it was). |

**Rounds screen pieces (FEAT-018, ADR-0030)** — feature components, not primitives:
`PriceLadder` (tiers as steps, live fill, "N more … and everyone pays ₹X"),
`RoundsSummary` (Open · You're in · Could save — `Fact size="large"`), `InviteButton`
(share sheet → clipboard → toast), `Celebrate` (`animate-confetti`, never under reduced
motion), and the last-day clock (`useNow` + `formatClock`).

Two rules keep them honest:

- **Variation is a closed prop, not a className.** Pass `className` for placement
  (margins, grid spans), never to reach inside. Missing variant → add the variant.
- **`features/*` depends on `components/ui/*`, never the reverse.** Asserted by test;
  it already caught `QueryState` importing a hook out of `features/shell`.

## Adding to the system

1. Need a new value? Add the **token** (`theme.css`) and its **utility**
   (`tailwind.config.js`) — then use the utility.
2. Need a new surface or motion? Add it as a named class in `theme.css` beside its
   family, so it is disabled with the rest under reduced motion.
3. Run `bash scripts/verify.sh`. `design-system.test.tsx` fails the build on a
   hard-coded colour, a missing palette token, a contrast regression, a control under
   44px, or a component that branches on the theme.
