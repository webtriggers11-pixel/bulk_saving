# FEAT-011 — Resident UI redesign: themeable design system, motion layer, skeletons

**Status:** specced (autonomous) · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-19

## Problem / Why

The resident PWA is built on default Tailwind utilities: `slate`/`teal-700`, `rounded-md`,
`shadow-sm`, the system font stack, emoji as service icons, and per-component one-off values.
It is legible and it is generic. For a product whose only pitch to a resident is **trust me
with your money and your neighbours' coordination**, "looks like an unstyled admin tool" is a
conversion problem, not a taste problem.

Three concrete gaps:

1. **No token layer.** Radii (`rounded-md`, `rounded-xl`, `rounded-full`), greys and shadows
   are chosen per component, so nothing can be changed globally and nothing is consistent.
2. **No loading craft.** Every screen's loading state is the sentence "Loading rounds…".
   A group-buy screen whose whole value is a live count deserves a skeleton of the real
   layout.
3. **No theming.** A single hard-coded teal is compiled into 40+ class names. Any future
   per-society or per-user palette means touching every component.

The owner approved a design (canvas, 14 artboards, stored under `design/` in this folder)
covering every resident screen, its states, its motion and three palettes. This item
implements that design in `apps/web` **without changing a single feature**.

## Scope — what changes

Visual system only, plus the loading states the design specifies:

- a **token layer** (CSS custom properties + Tailwind theme extension): colour, surface,
  radius, elevation, blur, spacing, motion;
- **three palettes** (teal default, indigo, ember) selected by `data-theme` on `<html>`;
  no user-facing switcher in this item (see Out of scope);
- **UI primitives** restyled: Button (5 variants + icon), Card, Input, Label, Badge, Toast;
- **shell** restyled: AppShell ground, BottomNav (glass tab bar), OfflineBanner, UpdatePrompt;
- **six resident screens** re-laid-out per the artboards: Onboarding (3 steps), Home,
  Services, Group buys, My Requests, Profile;
- **skeleton components** replacing the three "Loading …" sentences on the resident screens;
- a **motion layer** (entrance stagger, press/hover, focus ring, shimmer, pulse, sheen,
  count-up on the round counters), fully disabled under `prefers-reduced-motion`.

## Out of scope — explicitly NOT in this item

- **Admin screens.** `/admin/*` keeps its current look. The token layer is available to it,
  but re-skinning it is separate work; the owner asked for resident-facing UI only.
- **A theme switcher in the product.** The palettes exist and are selectable at the root
  element; wiring a per-user preference (store + persistence + API) is a feature with data,
  and belongs in its own item.
- **Any change to behaviour**: routes, API calls, query keys, copy strings, `data-testid`
  attributes, form fields, validation, offline rules, auth. If a test asserts it today, it
  must still assert it after.

## Acceptance criteria

1. **AC1 — No behavioural change.** `bash scripts/verify.sh` passes with every existing
   resident test green, unmodified except where a test asserts a *style* (class name or
   inline colour), which may be updated to assert the new equivalent.
2. **AC2 — Tokens, not literals.** No resident component contains a raw hex, a raw
   `rgba(...)` shadow, or a `teal-*`/`slate-*` Tailwind colour class. Every colour, radius,
   shadow and duration resolves through a token.
3. **AC3 — Three palettes.** Setting `data-theme="indigo"` or `"ember"` on `<html>` re-tints
   every resident screen — brand, gradients, tints, glow and shadow tint — with no layout
   shift and no component edit. A test asserts the variables change and the layout does not.
4. **AC4 — Skeletons.** Home, Services, Group buys and My Requests render a skeleton that
   mirrors their real geometry while `isLoading` is true, instead of a sentence. The existing
   "Loading …" text stays available to assistive tech (`aria-busy` + visually-hidden label)
   so the current tests' intent survives.
5. **AC5 — Motion is opt-out.** Every animation is off under `prefers-reduced-motion: reduce`;
   no animation blocks interaction; no layout shift after entrance.
6. **AC6 — Touch targets.** Every interactive element is ≥44×44 px (buttons 50, icon buttons
   48, tab items 58), as the artboards specify.
7. **AC7 — Contrast.** Body text ≥4.5:1 and large text ≥3:1 against its actual surface in all
   three palettes.
8. **AC8 — The design is stored.** The canvas index and all 14 artboards live in
   `design/` in this folder, so the implementation can be diffed against the source of truth.

## Non-goals / risks

- **Risk: glass on low-end Android.** `backdrop-filter` is expensive. Mitigation: blur is
  used on ≤3 surfaces per screen (cards, tab bar, sheet), and each glass surface keeps an
  opaque-enough background that it degrades to a flat card where the filter is unsupported.
- **Risk: test churn.** Tests that assert `class="bg-teal-700"` will fail. That is expected
  and is the only category of test change this item permits; each one is noted in the diff.
- **Risk: scope creep into admin.** Guarded by the Out-of-scope list; the admin screens are
  not touched in this item.

## Source of truth

`design/canvas.json` + `design/*.dc.html` (14 artboards: 3 onboarding, 4 app screens,
Profile, States, Motion, Skeletons, Themes, Tokens, Components). Published canvas:
https://claude.ai/artifact/BbGhsSzNC47hds97Bg5gLe
