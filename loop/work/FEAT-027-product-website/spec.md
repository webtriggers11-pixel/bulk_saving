# FEAT-027 — Product website (`apps/site`): Astro, one page, the app's own look, a 3D society that fills as neighbours join

**Status:** specced (autonomous — owner directed the loop to run without sign-off) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-10-20

("create new folder in apps using astro create beautiful product website to show peoples also add 3d
animation for this product and all using same theme consistency SPA is fine") · **Decisions:** ADR-0038
(builds on ADR-0029 Mono look, ADR-0031 accent pairs)

## Problem / Why

Bulk Saving has no public face. The resident PWA is behind an invite code and the admin behind a
phone door, so a society committee, a vendor, an investor or a journalist has nothing to look at.
`FEATURES.md` (2026-10-19) already says what to show and why; this item turns it into a site.
It must be unmistakably the same product as the app: the Vercel look (flat paper, hairlines, Geist,
tight radii), Mono's neutral ground, the seven accent pairs, light and dark — the tokens the app
ships in `apps/web/src/styles/theme.css`, not a re-interpretation of them. The owner asked for 3D:
the one memorable moment is a society building whose windows light up as neighbours pledge and
whose price ladder drops — the core mechanic made visible.

## User stories

1. As a visitor, I understand in one screen what Bulk Saving does and why a group buy is cheaper.
2. As a visitor, I can *play* the mechanic: pledge units, watch neighbours join, see windows light up
   and the price fall tier by tier.
3. As a visitor, I can read every shipped feature, grouped by what it is for, with what it does and
   why it exists — and nothing that is not shipped is sold as shipped.
4. As a visitor on a phone, in dark mode, or with reduced motion, the site works and looks intended.
5. As a visitor, I can switch the colour pair and the scheme exactly as a resident can in the app.

## Acceptance criteria (testable — this IS the definition of done)

- [ ] AC1 — `apps/site` is a pnpm workspace (Astro, static output, one page `/` with anchor
      navigation) with `lint`, `typecheck`, `build`, `test` scripts, picked up by
      `scripts/verify.sh` through `pnpm -r` with no gate change needed.
- [ ] AC2 — **Theme consistency is a test.** `src/styles/tokens.css` declares the same `--brand`,
      `--brand-2`, `--brand-deep`, `--brand-light`, `--brand-ink` for all seven accents by day and
      by night, Mono's ink/ground/paper by day and by night, the Vercel radii and font stacks, as
      `apps/web/src/styles/theme.css`; a Vitest test parses both files and fails on any drift.
      `<html>` carries `data-look="vercel" data-theme="mono" data-accent data-scheme` like the app;
      the pre-paint script reads the same `bulk:scheme` / `bulk:palette` keys.
- [ ] AC3 — **Content is a test.** `src/content/features.ts` is derived from `FEATURES.md`; a test
      asserts every `FEAT-NNN` with status `done` in `loop/REGISTRY.md` appears on the page, every
      ID the page names exists in the registry, and every item the page marks "coming soon" is NOT
      `done` (today: FEAT-020 web push). `FEATURES.md` is updated to include FEAT-023..026.
- [ ] AC4 — **3D hero.** A Three.js scene of a society building (flat-shaded, ink edges, accent-lit
      windows) that responds to a "Join" control: each pledge lights windows and advances a price
      ladder (₹1,000 → ₹800 → ₹700) with a spark burst on a tier unlock. Window and edge colours
      come from the CSS tokens so switching accent or scheme recolours the scene live. Under
      `prefers-reduced-motion` the building is static (no idle rotation, no sparks) but still
      lights up on pledge. The scene module is lazy-loaded; the page renders fully without WebGL
      (a static SVG building stands in). The tier/lighting arithmetic lives in a pure module with
      unit tests.
- [ ] AC5 — **The page.** Sections, in order, each with an `id` and a nav link: hero + demo; how a
      group buy works; browse, ask, book; never miss a round; trust and accountability; built for a
      phone; a look you want to open (live accent swatches + scheme switch); for operators; bulk
      staples pilot; not yet (honesty); footer. A container-rendered test asserts every section id,
      that every nav href resolves to one, and that every shipped feature title is present.
- [ ] AC6 — **Quality floor.** Responsive 360px → 1440px with a 16px gutter and no horizontal
      scroll; visible focus rings; all text ≥ 4.5:1 on its surface in both schemes (asserted for the
      tokens the page uses); no literal `white`/`#fff` on an accent fill (uses `--on-fill`);
      every animation stops under reduced motion; `<title>`, description, OG tags, favicon.
- [ ] AC7 — Browser pass at 390px and 1280px, light and dark, two accents; screenshots in the LOG.
- [ ] AC8 — V1 gate, V2 by the code-reviewer subagent, V3 double run; LOG, REGISTRY, HANDOFF.

## Out of scope (explicit, prevents gold-plating)

A CMS, a blog, forms that post anywhere (the CTA links to the app's invite door and a mailto),
analytics, i18n, hosting/deploy (DEPLOY.md gets a note only), reusing React components from
`apps/web` (the site is Astro-static; it shares TOKENS, not components), a Three.js scene per
section (one scene, in the hero).

## Open questions (resolved autonomously, per the owner's standing direction)

- Astro 7 (current, 7.4.1) or 5? → **7**: current major, static output, container API for tests.
- 3D library? → **Three.js** (0.186): the standard, tree-shakes to ~150 kB gz, lazy-loaded.
- SPA? → Astro static with a single page and anchor nav satisfies "SPA is fine" without client routing.
- Node: Astro 7 needs Node ≥ 22; STACK.md already says Node 24; CI pins 20 → bump CI to 24.
