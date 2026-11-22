# FEAT-030 — Website hero you play with: tap a window to invite that flat, drag to turn the society, a live feed, a price that visibly falls

**Status:** specced · **Priority:** P2 · **Owner:** owner ("make more creative hero section so people will stop and read and check using the 3d model … interactive, micro animation … as didn't anyone created yet … same component UI system") · **Opened:** 2026-11-22 · **Parent:** FEAT-028

## Problem / Why
The hero's 3D society only reacts to two buttons under it. Visitors look at it and scroll past; nothing invites a hand. The product's idea (each flat that joins lowers everyone's price) can be *felt* in the first five seconds if the model itself is the control.

## User stories
1. As a visitor, I can tap any window of the 3D society to invite that flat, and see it light, a "+1" rise from it, and the price fall.
2. As a visitor, I can drag the towers to turn them.
3. As a visitor who does nothing, I see neighbours joining on their own for a few seconds, so the page feels alive and shows me what to do.

## Acceptance criteria
- [ ] AC1 Hovering a window (3D) highlights it and shows a tip naming the flat ("A-604 · tap to invite" / "A-604 is in"); tapping an unlit window lights *that* flat (the tapped window and up to two same-floor neighbours) and adds one unit. At the target the tap says the best price is already unlocked; the count never passes the target.
- [ ] AC2 Drag turns the society (clamped, with inertia, springs back); a drag never counts as a tap; vertical touch scroll is not hijacked (`touch-action: pan-y`).
- [ ] AC3 Each join: a feed card slides into the scene (newest first, max 3) naming the flat and units; a "+N" chip arcs from the window to the price; the price counts to its new value.
- [ ] AC4 Idle autoplay: when the hero is visible and the visitor has not interacted, a neighbour joins every ~2.4 s until 6 units (crosses the first tier, burst + ring); any interaction stops it for good. Off under reduced motion.
- [ ] AC5 A tier unlock adds a shockwave ring on the ground (3D); the scene's accent glow grows with progress. All colours are tokens; follows accent + scheme live.
- [ ] AC6 A kicker above the headline invites the hand; scene shows "Drag to turn · tap a window". SVG fallback still works without WebGL (feed, chip, price all run).
- [ ] AC7 Pure logic (flat labels, a flat's windows, promoting a flat in the lighting order) is unit-tested; page test pins the new hooks; V1, V2, V3.

## Out of scope
New dependencies; changes to the story section's scene; sound.

## Open questions
- none (autonomous mode; picks recorded in plan.md)
