# BUG-023 — Catalog chips: the section below jumps up over the cards while the filter animates, then drops back

**Status:** in-review · **Priority:** P2 · **Opened:** 2026-10-20 · **Reporter:** owner ("Browse, ask, book … when I click on tabs it overlaps and then goes")

## Observed vs expected
- **Observed:** clicking a category chip in "Browse, ask, book" makes the wall of cards collapse to 0px for the length of the Flip (0.55s + stagger). The "Updates" section slides up by the wall's height over the flying cards, then snaps back down when the Flip completes. The leaving cards also fade out on top of the cards sliding into their places.
- **Expected:** the cards slide to their new places, the leavers fade behind them, and the page below glides to the wall's new height.

## Reproduction (the spec for this bug)
- Measured in Chrome at http://127.0.0.1:4321/#services (2026-10-20): wall height 456 → 0 at the click, next section top 1768 → 1312, every card `position: absolute` for the duration.
- **Failing test:** `apps/site/src/scene/catalog.flip.test.ts` — pins the Flip to `absoluteOnLeave` (not `absolute: true`), a held wall height during the tween, and a positioned wall with leavers stacked underneath. Vitest runs in node (no layout engine), so the test reads the source, as `catalog.seed.test.ts` reads the seed.

## Root cause
`Flip.from(state, { absolute: true })` in `catalog.ts` (FEAT-028 T5d). `absolute: true` takes EVERY card out of flow for the animation, so a grid with no fixed height has nothing left to size it. GSAP's own guidance for this: `absoluteOnLeave: true` (only the leavers go absolute) — and animate the container's height yourself if the layout below must not jump.

## Decision-log check
ADR-0039 unaffected (GSAP Flip stays the mechanism).

## Fix
- `absoluteOnLeave: true`; the wall's height tweens from the old to the new value on the same timeline, cleared on complete; `ScrollTrigger.refresh()` on complete so the reveals below re-measure; `.wall` is `position: relative`, cards `z-index: 1`, leavers `.svc--leaving` at `z-index: 0` with pointer events off.
- **Regression guard:** `catalog.flip.test.ts`.

## Lesson
`absolute: true` in Flip is for containers that size themselves; an auto-height grid needs `absoluteOnLeave` plus its own height tween.
