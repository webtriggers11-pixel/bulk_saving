# FEAT-018 — Group buys that feel alive: price ladder, live countdown, invite, celebrate

**Status:** specced · **Priority:** P1 · **Owner:** Vivek (requested) / agent · **Opened:** 2026-10-19

## Problem / Why

Owner: "use modern components for user-facing to make it eye-catching, and users will be
happy while using /rounds — can we make it more creative". The rounds screen is a stack
of identical cards; the mechanic that makes a group buy exciting — *the more neighbours
join, the cheaper it gets for everyone* — is reduced to one line of text ("Unlocks ₹700
at 10 AC units"), even though every round already carries its full tier ladder. Nothing
answers "what's in it for me", nothing helps a resident pull a neighbour in, and joining
has no moment of delight.

## User stories

1. As a resident, I see at a glance what's open, what I've joined, and what I could save.
2. As a resident, I see each round's price ladder — every tier, where the round is now,
   and how many more units unlock the next price — so I understand why to join.
3. As a resident in a round that is close to its next price, I can invite neighbours with
   one tap (phone share sheet, or copy a link where there is none).
4. As a resident, joining or raising my pledge — and a round unlocking a cheaper tier —
   feels like a small win.
5. As a resident, a round closing within a day shows a live ticking countdown.

## Acceptance criteria (testable — this IS the definition of done)

- [ ] AC1 — a summary strip above the list: open rounds, rounds I've joined, and my best
      possible saving (Σ over joined rounds of (first-tier price − best tier price) × my
      units; hidden when 0). Derived from the existing `GET /rounds` data only.
- [ ] AC2 — `PriceLadder`: one step per tier in threshold order, each showing price and
      threshold; reached steps marked, the current one highlighted, a fill showing the
      live count's position; "N more <units> to unlock ₹X" (or "Best price unlocked").
      Accessible: a list with readable text, the fill decorative.
- [ ] AC3 — "Invite neighbours" on every open round: `navigator.share` with a text + the
      rounds URL when available, otherwise copies it to the clipboard and confirms with a
      toast. No personal data in the shared text or URL.
- [ ] AC4 — joined rounds are visibly yours: a "You're in" mark and "your N <units>".
- [ ] AC5 — a celebration (CSS particle burst, no dependency) when a join/update succeeds,
      and on a card when its tier advances while on screen; none under reduced motion.
- [ ] AC6 — under 24h, the deadline badge ticks live (HH:MM:SS), once a second, cleaned
      up on unmount; otherwise unchanged.
- [ ] AC7 — the tier ring's drop-shadow artifact (a grey box behind the arc in Mono) is gone.
- [ ] AC8 — works in all four palettes and both schemes (tokens only — the existing design
      tests pass); browser pass at phone width, day and night.

## Out of scope (explicit, prevents gold-plating)

- API/schema changes (residents-per-round counts, referral tracking).
- Filtering/sorting rounds (ADR-0026 says filters are server-side; not asked for).
- Restyling the other resident screens — follow-up item if wanted.

## Open questions (agent must ask, never assume)

- Share link target → the society's `/rounds` URL (no deep link per round exists yet).
  (agent, autonomous mode)
