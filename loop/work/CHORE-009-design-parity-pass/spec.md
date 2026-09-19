# CHORE-009 — Design-parity pass: every screen checked against its artboard, in a browser, and the gaps closed

**Status:** specced (autonomous) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-19

## Why

FEAT-011 and CHORE-008 built the design; BUG-007 then proved that 35 of its size and
radius choices had never actually rendered. Which means **no screen has been seen in its
finished state**: every browser check so far ran against a build where titles were 19px,
code fields were 15px and skeleton corners were stadiums.

The owner's ask is plain — "I want properly working same design UI that we have created".
So this item does the one thing no test can: put each screen next to its artboard, at the
size a resident holds, and close what does not match.

## Scope — frontend only

- Every resident screen at 390×844, and every admin screen at desktop width, compared
  against `loop/work/FEAT-011-resident-ui-redesign/design/*.dc.html`.
- Each mismatch either fixed in the app, or recorded as a deliberate difference with the
  reason (the artboards are a drawing; a few things are wrong in the drawing, not the app).
- Every state that is reachable: loading skeletons, empty, error, offline, and the joined
  and not-joined variants of a round.

## Explicitly out of scope

- **Anything server-side.** No SMS provider, no backend changes, no schema. The API is
  used only as a data source to render against.
- **The webfont decision.** Plus Jakarta Sans keeps loading over the CDN; the owner has
  said the font choice is provisional and will be revisited. Not a blocker, not raised again.
- New features, copy changes, route changes.

## Acceptance criteria

1. **AC1 — every screen seen.** Each of the ten screens captured in a browser in its
   finished state, plus the loading, empty and error states that have a design.
2. **AC2 — differences are closed or recorded.** A written list, per screen: what differed,
   and whether the app moved or the drawing was wrong.
3. **AC3 — measured, not eyeballed.** Where the difference is a size, a radius, a weight or
   a colour, it is read from computed style and compared to the artboard's value.
4. **AC4 — no behavioural change.** Same routes, API calls, copy, testids. The gate stays
   green and no test is weakened.
5. **AC5 — it works.** Every interactive control on every screen is exercised at least once
   in the browser: stepper, join, leave, rating, filters, forms, nav.
