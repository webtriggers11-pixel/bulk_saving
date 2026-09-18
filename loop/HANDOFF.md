# HANDOFF — session state

> External memory between sessions. Overwritten by the session-handoff skill
> at the end of every session; history lives in git.

## Last session

- **Date:** 2026-09-19
- **Goal:** Redesign the whole product on the approved design, autonomously: store the
  design as the UI system, apply it to every screen, factor the repetition (SOLID),
  verify in a browser, and keep the Loop's V1→V2→V3 gates.
- **Result:** **FEAT-011, CHORE-008 and BUG-007 closed.** 21 of 21 registry items done.
  Every screen in the product — six resident, four admin — is on one token layer with
  three swappable palettes, eight shared screen primitives, real skeletons and a motion
  layer with one off switch.

## Where the system lives

| | |
|---|---|
| Written system | `DESIGN-SYSTEM.md` (root) |
| Tokens, palettes, surfaces, motion | `apps/web/src/styles/theme.css` |
| Primitives | `apps/web/src/components/ui/` |
| The canvas — one canvas, 18 boards, all 10 screens | `loop/work/FEAT-011-resident-ui-redesign/design/` · https://claude.ai/artifact/BbGhsSzNC47hds97Bg5gLe |
| Decisions | ADR-0021 (tokens + themes), ADR-0022 (screen primitives) |

## The thing this session actually learned

**A test that reads source or config cannot verify a style.** Four separate defects of
one shape shipped past a green suite:

| | What did nothing | Found by |
|---|---|---|
| FEAT-011 | `fill-*` — collided with a Tailwind namespace | opening the app |
| FEAT-011 | 11 alpha steps (`bg-amber-ink/12`) — off Tailwind's scale | review |
| CHORE-008 | `Card` padding via className — lost to the base | review |
| BUG-007 | 35 overrides (`CardTitle`, `Input`, `Skeleton`) — lost to the base | the test written to find them |

Three guards exist because of it, and **each one shipped broken first**:
1. `scripts/check-css-classes.mjs` (gate step, after build) — every class must resolve
   to a rule in the BUILT stylesheet. First version inspected zero tokens and reported
   success; it now fails below a floor.
2. `class-conflicts.test.tsx` — renders every primitive, reads the classes it really
   produces, fails if a caller passes one in the same CSS-property family. Same
   capture-group bug as (1) on its first run; same floor added.
3. `primitives.test.tsx` — one owner per shape, and `features → components/ui|lib`
   never the reverse. Caught two live inversions the day it was written.

If you add a fourth guard, give it a floor. Twice is a pattern.

## Verification contract

`bash scripts/verify.sh` — shared types → prisma → lint → typecheck → build →
**css classes** → tests. Dev infra (`docker compose up -d`) must be up.

## What needs the owner

1. **The webfont is a CDN link, not a dependency.** Approving
   `@fontsource/plus-jakarta-sans` makes the PWA's first offline visit use the real
   typeface. Until then it falls back to system sans (layout holds, letterforms change).
2. **Still no SMS provider** — the one thing that makes the product unusable in
   production rather than merely unhardened. DEPLOY.md §0.
3. **AC5 wording:** the canvas lives in FEAT-011's folder with all 18 boards rather
   than split per work item. Two half-canvases opened incompletely; one whole one does
   not. Worth a nod if you disagree.

## Known, tracked, not blocking

- **CHORE-006** (admin has no services page) — still `triaged`, untouched.
- The session wiring (`SessionPort`) is now a module side effect of `auth.store.ts`. It
  is a real dependency inversion and acyclic, but a guarantee that used to be
  structural is now conventional: if the store ever leaves the entry import graph, every
  authed request silently drops its token. Worth a composition-root call in `main.tsx`
  or a dev-only warn.
- Browser verification is recorded in commits and LOG, not as stored captures. Every
  claim in them was measured (computed styles, scroll positions), not eyeballed.
