# CHORE-010 — "Unlocks ₹900 at 4 flats" when ₹900 is already the price

**Status:** triaged · **Priority:** P3 · **Opened:** 2026-09-19 · **Found by:** CHORE-009's browser pass

`nextTier` is the first tier not yet *reached*, so on a round nobody has joined, the first
tier is "next" — and its price is the price already being shown. The card then reads
"₹900 / flat" above "Unlocks ₹900 at 4 flats", which promises a saving that is not one.

Not a rendering bug: the card is faithfully showing the field. Either the API should not
offer a tier whose price equals the current one, or the copy should say what that first
tier actually is ("₹900 holds at 4 flats", or nothing until a cheaper tier exists).

Needs a decision from the owner about what the first tier MEANS before either is right.
