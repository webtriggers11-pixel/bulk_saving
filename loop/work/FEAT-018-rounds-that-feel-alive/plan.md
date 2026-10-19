# FEAT-018 — plan

Frontend only (apps/web). No dependency, no API change. Decision record: ADR-0030.

1. `features/rounds/roundMath.ts` — pure helpers: sorted tiers, reached index, units to
   next, saving per unit, best saving across joined rounds. Unit-tested.
2. `PriceLadder.tsx` — tier steps + fill + "N more to unlock". Replaces `TierLine` on cards.
3. `RoundsSummary.tsx` — the strip (AC1).
4. `InviteButton.tsx` — Web Share → clipboard → toast fallback (AC3).
5. `Celebrate.tsx` + `useTierAdvance` — particle burst on success / tier advance (AC5);
   classes in theme.css, collapsed by the reduced-motion block.
6. `useNow`-style live countdown under 24h in the badge (AC6).
7. TierRing: drop the SVG `drop-shadow` filter (AC7).
8. Tests for each; browser pass; DESIGN-SYSTEM.md.
