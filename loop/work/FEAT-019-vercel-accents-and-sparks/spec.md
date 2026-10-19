# FEAT-019 — One Vercel look, seven colour combinations, and micro-interactions that spark

**Status:** specced · **Priority:** P1 · **Owner:** Vivek (requested) / agent · **Opened:** 2026-10-19

## Problem / Why

Owner: "again you change — I want the Vercel theme type, but use modern components; also
give users the choice of multiple colour combinations; also add some micro-interaction
animation to look creative — some sparks and all, a modern and creative look."

FEAT-017 made Vercel ("Mono") one palette among three glass palettes, so picking a colour
also brought the old glass look back. The owner wants ONE look — Vercel's — with colour as
a choice inside it, and more delight in the interactions.

## User stories

1. As a user, whatever colour I pick, the app keeps the Vercel look (flat, hairlines, Geist).
2. As a user, I can choose among several colour combinations (each a pair of hues), in
   light and dark.
3. As a user, the app feels alive: things respond to my pointer and my taps, with small
   sparks and light — never in the way, and never if I asked my phone for less motion.

## Acceptance criteria (testable — this IS the definition of done)

- [ ] AC1 — look and colour are separate: `data-look="vercel"` carries the geometry/surfaces
      (FEAT-017's section, re-keyed); `data-accent` carries the colour pair. The pre-paint
      script and `lib/appearance.ts` always set the Vercel look.
- [ ] AC2 — seven accents — mono, ocean, aurora, bloom, sunset, forest, lagoon — each
      `--brand`, `--brand-2` (the gradient partner), `--brand-deep`, `--brand-light`,
      `--brand-ink` by day and by night; brand-ink ≥ 4.5:1 on ground and paper; on-fill ≥
      4.5:1 on brand and brand-deep, both schemes (tested).
- [ ] AC3 — stored legacy palettes migrate: teal → lagoon, indigo → aurora, ember → sunset;
      unknown → mono. Appearance offers the seven as two-tone swatches.
- [ ] AC4 — the pair is used: ring arc, ladder fill, accent card and an aurora glow at the
      top of the ground are brand → brand-2 gradients.
- [ ] AC5 — micro-interactions: (a) cursor spotlight on interactive cards; (b) a light beam
      travelling the lead card's border; (c) twinkling sparkles on "Could save" and "Best
      price unlocked"; (d) gradient shimmer text on the headline saving; (e) a spark burst
      from a primary button on press.
- [ ] AC6 — every one of AC5 is off under `prefers-reduced-motion` (CSS block + JS checks),
      none moves layout, and markup is identical across accents.
- [ ] AC7 — browser pass at phone width: several accents, light and dark; no console errors.

## Out of scope

- Deleting the dormant glass palette CSS (teal/indigo/ember blocks) — kept, unreachable from
  the UI; a CHORE if the owner wants it removed.
- New screens or layout changes beyond the decorations above.

## Open questions

- Keep any glass look selectable? → No: "I want the Vercel theme type" (owner).
