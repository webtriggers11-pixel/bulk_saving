# Plan FEAT-030 — Interactive hero

**Derived from:** spec.md · **Approved by:** agent (autonomous mode, owner directive) on 2026-11-22

## Technical approach
- `model.ts` (pure, tested): `flatLabel(win)` → "A-604"; `flatOf(windows, idx)` → the tapped window plus up to two unlit-or-not neighbours on the same tower/face/floor; `promote(order, litN, indices)` → a new order where those indices sit right after the lit prefix, so the next unit lights exactly them. The SVG fallback and the 3D scene keep sharing one order.
- `building.ts`: option `interactive` (hero only) adds raycast pick/hover on the window InstancedMesh, drag-to-orbit with inertia and spring-back, a hover tint, `setOrder()`, `project(idx)` (window → container px), and a ground ring on tier bursts. Story scene unchanged (option off).
- `hero.ts`: owns order + units; tap → promote + join; feed cards; the arcing chip (outer x linear, inner y ease-in = parabola, WAAPI); price tween; autoplay with stop-on-interaction; `--progress` on the scene for the glow.
- `Hero.astro` + `site.css`/`fx.css`: kicker, feed, tip, hint; tokens only (ADR-0039, ADR-0029/0031). Reduced motion: no autoplay, no arc, instant price.

## New decisions required
None — no dependency, no new library; rides ADR-0039 §4 (Three.js scene loaded on demand, tokens pinned).

## Risks
Raycast cost on pointermove (94 instances; negligible). Drag vs scroll on touch (pan-y). Autoplay fighting a visitor (stops on first pointerdown/keydown in the hero).
