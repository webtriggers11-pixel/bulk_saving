# FEAT-023 — Home leads with Group buys

**Status:** done · **Priority:** P1 · **Owner:** owner (requested) / agent · **Opened:** 2026-10-19

## Problem / Why

Owner: "Group buys — this is the main feat we have, right, and in the home screen it looks hidden. Make sure this is the point of contact; work on UI/UX." Today Home gives the one accent surface to "Explore services" and tucks Group buys into a small square tile at the bottom. The product's core loop (join a round, save together) is the least visible thing on the first screen.

## User stories

1. As a resident, when I open the app I see straight away what group buys are open, which ones I am in, and how close they are to closing — and one tap takes me into a round.
2. As a resident with nothing open in my society, Home tells me so plainly and points me at Services (ask for one).

## Acceptance criteria

- [x] AC1 — Home's single accent surface is Group buys: eyebrow, title, and the live numbers (open rounds · you're in) from the same `['rounds']` query the Rounds tab uses (no new endpoint, polled the same way).
- [x] AC2 — Under it, up to three open rounds as compact rows: service name, current price per unit, closes-in, a "You're in" mark when `myUnits > 0`. Each row deep-links to `/rounds?join=<id>` (FEAT-021), which opens that round's pledge sheet / scrolls to it.
- [x] AC3 — A "See all N group buys" action to `/rounds` ("See group buys" when all fit on Home). Services and Your society become the two square tiles; the identity card and super-admin entry are unchanged.
- [x] AC4 — Empty: no open rounds → the lead card says so and offers Services. Loading: `HomeSkeleton` mirrors the new geometry. Error: the existing `QueryErrorState` for the `me` query is unchanged; a failed rounds query degrades to the lead card without rows (never blank).
- [x] AC5 — Phone width (360px): no horizontal scroll, prices aligned, rows ≥ 44px touch targets (BUG-016 guards stay green).
- [x] AC6 — Tests: lead card shows counts and rows from mocked rounds; empty state; row navigates with the join param; super-admin/resident tests unchanged; gate green; V2; V3.

## Out of scope

- Joining from Home itself (the pledge sheet stays on Rounds; the deep link opens it).
- Any change to the Rounds tab or the Services tab.
