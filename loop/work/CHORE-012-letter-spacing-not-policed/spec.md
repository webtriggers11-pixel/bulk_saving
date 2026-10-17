# CHORE-012 — the BUG-007 scan does not police letter-spacing, and two fields are exposed

**Status:** done (closed 2026-10-17) · **Priority:** P2 · **Opened:** 2026-09-19 · **Found by:** V2 round 2 of CHORE-009

`class-conflicts.test.tsx` classifies padding, margin, gap, radius, display and font-size.
There is **no letter-spacing family**, so a `tracking-*` on a primitive's base is unpoliced —
and CHORE-009 just added `tracking-*` to `CardTitle`'s size tokens, creating exactly that.

It is already live, pre-existing, on the two fields whose design IS their letter-spacing:

- `Input` has emitted `tracking-[-0.01em]` since FEAT-011 (`input.tsx`).
- `OnboardingPage` invite code passes `tracking-[0.26em]`, OTP code passes `tracking-[0.38em]`.

Both land; the stylesheet decides. Measured in the built CSS: base at byte 32521, callers at
33066 and 33109 — **the callers win, so both render correctly today**. Latent, not live, and
latent for precisely the reason BUG-007 exists.

## Fix

1. `familyOf()` gains `if (/^-?tracking-/.test(bare)) return 'letter-spacing';`
2. It will then flag the two `OnboardingPage` sites. Resolve them the way BUG-007 resolved
   the rest: a closed prop on `Input` (it already has `textSize`), not a className.
3. While there, consider the other families a base class could occupy — `leading-*`,
   `font-*`, `shadow-*` — and whether the scan should enumerate families or invert the
   question and flag any base class a caller repeats.
