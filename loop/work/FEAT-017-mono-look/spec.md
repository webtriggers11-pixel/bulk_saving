# FEAT-017 — A Vercel-style "Mono" look, in day and night

**Status:** specced · **Priority:** P1 · **Owner:** Vivek (requested) / agent · **Opened:** 2026-10-19

## Problem / Why

Owner: "can we give some UI/UX like Vercel components to look more appealing and cool in
dark and white mode". Today's look is liquid glass — mesh washes, blur, 24px radii, lit
gradients. Vercel's (the Geist system) is the opposite register: flat monochrome
surfaces, crisp 1px hairlines, tight radii, the Geist typeface, a faint grid ground, a
black primary button by day that becomes white by night. The token layer (ADR-0021) was
built so a new look is CSS, not a component rewrite — this item uses it that way.

## User stories

1. As anyone opening the app on a new device, I see the Mono look by default, in my
   phone's light or dark scheme.
2. As a resident or admin, I can still pick Lagoon, Dusk or Ember in Appearance, and my
   choice is remembered (existing stored choices are respected).
3. As an admin, the dashboard reads like a Vercel dashboard: flat cards with hairlines,
   tight corners, quiet hover states.

## Acceptance criteria (testable — this IS the definition of done)

- [ ] AC1 — `data-theme="mono"` is a fourth palette: day and night blocks declaring the same
      token names as the others; every ink ≥ 4.5:1 on its ground and paper, by day and by
      night; the fill text (`--on-fill`) ≥ 4.5:1 on `--brand` and `--brand-deep`.
- [ ] AC2 — geometry and type are tokens: radii (`--radius-*`) and the sans family
      (`--font-sans`) are CSS variables; the three existing palettes keep today's values
      exactly; Mono uses 6/8/8/10/12/16px radii, Geist, and Geist Mono for the micro-labels.
- [ ] AC3 — Mono surfaces are flat: paper with a 1px hairline, no backdrop blur on cards, no
      mesh washes or ambient drift, a faint fading grid on the ground; hover darkens the
      hairline instead of lifting; no specular sweep, sheen or halo; primary button is the
      ink colour (black by day, near-white by night) with a light shadow.
- [ ] AC4 — text and marks on an accent fill use `on-fill`, never literal `white`, so a
      light fill at night carries dark text. The white allowlist shrinks to the switch knob and the swatch tick (always on a day fill).
- [ ] AC5 — Mono is the default for a device with no stored palette (pre-paint script and
      `lib/appearance.ts` agree); unknown stored values fall back to Mono; Appearance lists
      it first as "Mono"; the status-bar colour table covers it.
- [ ] AC6 — markup is byte-identical under all four palettes (the look stays CSS).
- [ ] AC7 — browser pass: resident Home/Profile and admin dashboard, Mono day and night, at
      phone width; no console errors.

## Out of scope (explicit, prevents gold-plating)

- New components (command menu, toasts redesign) or layout changes — this is a look.
- Self-hosting fonts (needs a dependency; same CDN route as ADR-0021).
- Changing the three existing palettes.

## Open questions (agent must ask, never assume)

- Default for new devices: Mono or keep Lagoon? → Mono — the owner asked for this look
  (agent, autonomous mode; reversible by one constant).
