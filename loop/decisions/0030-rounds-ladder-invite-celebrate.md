# ADR-0030: The rounds screen shows the tier ladder, invites through the share sheet, and celebrates in CSS

**Status:** Accepted · **Date:** 2026-10-19 · **Deciders:** Vivek ("modern components …
eye-catching … users will be happy using /rounds … more creative"), agent · **Work item:** FEAT-018

## Confidence

**Level:** High (all derived from data the screen already has; no API change) ·
Medium (whether residents use Invite — unmeasured)

## Research depth

**Quick check** — Web Share API (Safari iOS, Chrome Android, Chrome/Edge desktop; Firefox
desktop lacks it → clipboard fallback); `navigator.clipboard` needs a secure context
(localhost and HTTPS are).

## Decisions

1. **The ladder is drawn from `round.tiers`**, steps evenly spaced (not proportional to
   thresholds, which made early progress invisible), linear within a step. Math lives in
   `roundMath.ts`, pure and unit-tested; components only render it.
2. **Invite = Web Share, else clipboard, else show the link.** The text names the service
   and the next price only — never the sharer, flat or pledge — because it may be forwarded
   anywhere. The link is `/rounds` (no per-round deep link exists yet).
3. **Celebration is CSS particles** (16, deterministic positions, `--dx/--dy/--rot`), on a
   saved join/update and when a tier is reached while the card is on screen (tracked during
   render, like PledgeSheet's `open`). Not rendered under reduced motion, and hidden by the
   stylesheet's reduced-motion block as well. No confetti library (dependency rule; ADR-0008).
4. **The last day ticks** (HH:MM:SS) via `useNow(active)` — a timer only for rounds under
   24h, cleared on unmount.
5. **"Could save" is the caller's best case** (first-tier minus best-tier price × their
   units, summed over joined rounds) and shows a dash at 0.

## Revisit triggers

- A per-round deep link exists → Invite should point at it.
- Residents-per-round counts exist in the API → an avatar stack ("12 neighbours in").
- Invite usage measured low → demote it from the card to the sheet.
