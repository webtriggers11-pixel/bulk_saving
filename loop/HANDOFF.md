# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-19
- **Goal:** The owner approved a 14-artboard visual design for the resident PWA, asked
  for it stored in the repo as the UI system, and asked for the frontend changed to
  match it exactly — autonomously, without per-step approval.
- **Result:** **FEAT-011 closed.** 19 of 19 registry items are `done`. The resident app
  now runs on a token layer with three swappable palettes, real skeleton screens, a
  motion layer with one off switch, and six re-laid-out screens. V1 → V2 (three rounds
  with an independent reviewer that ran the gate itself) → V3 (two identical runs).

## Where the design lives

- `DESIGN-SYSTEM.md` (repo root) — the written system: tokens, the four ranked
  surfaces, type scale, radii, elevation, motion timings, how to extend it.
- `loop/work/FEAT-011-resident-ui-redesign/design/` — the canvas index and all 14
  artboards (`*.dc.html`), in-repo so the implementation can be diffed against the
  drawing rather than against a link. Canvas: https://claude.ai/artifact/BbGhsSzNC47hds97Bg5gLe
- `apps/web/src/styles/theme.css` — every colour, surface, radius, shadow, blur and
  duration, plus the three palettes on `[data-theme]`.

## The single most important thing this session learned

**540 passing tests told me a redesign worked while its primary button had no
background.** Twice: a Tailwind namespace collision (`fill-brand`), then eleven
off-scale alpha steps (`bg-amber-ink/12`). jsdom applies no CSS, so every style
assertion that reads source files or config is blind to it.

Three guards exist because of that, and **two had to be broken by an adversarial
reviewer before they were real**:

1. `scripts/check-css-classes.mjs` — runs in verify.sh between `build` and `test`;
   asserts every class token in `apps/web` resolves to a rule in the BUILT stylesheet
   (1072 today). It fails if the inspected count drops below 800, because a check that
   inspects nothing passes forever — which it did, on its first version.
2. `design-system.test.tsx` — hard-coded colours, palette gaps, theme-branching
   components, inline `animation`, sub-44px controls, contrast regressions.
3. Opening the app. The first defect was found at 390px in a browser, not by a test.

## Verification contract

`bash scripts/verify.sh` is still the one entrypoint. It now has an extra step:

```
shared types → prisma client → lint → typecheck → build → CSS CLASSES → tests
```

Dev infra (`docker compose up -d`) must be up for the backend integration suites.

## What needs the owner

1. **The webfont is a CDN link, not a dependency.** `index.html` loads Plus Jakarta Sans
   from Google Fonts because CLAUDE.md requires approval for any dependency. An offline
   first-visit falls back to the system sans stack — layout holds, letterforms change.
   Approving `@fontsource/plus-jakarta-sans` removes the caveat entirely.
2. **Still no SMS provider** (unchanged from the last session, and still the thing that
   makes the product unusable in production rather than merely unhardened). DEPLOY.md §0.
3. **A browser pass over the admin surfaces.** The resident screens were checked at
   390px this session (onboarding, profile, the failed-read state, and the sticky
   offline strip holding at 32px after a 700px scroll). `/admin/*` was deliberately not
   re-laid-out — it inherits the tokens and the primitives, so it looks different from
   before, and nobody has looked at it.

## Open items

- **CHORE-006** (admin has no services page) — still `triaged`, untouched.
- Nothing else is open. The blur budget, the touch floor, the contrast ramp and the
  class check are all enforced by the gate rather than by intention.
