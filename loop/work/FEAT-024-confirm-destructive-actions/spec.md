# FEAT-024 — Confirm before destructive actions

**Status:** done · **Priority:** P1 · **Owner:** owner (requested) / agent · **Opened:** 2026-10-19

## Problem / Why

Owner: "some actions need confirmation like logout, delete, leave etc". Today one tap logs a
resident out (and, since BUG-017, ends their lifetime session), leaves a round (their pledge
is gone and their place in the price ladder with it) or removes a rating. The admin's
"Cancel round" already asks first — inline, in its own hand-rolled box — so the product has
one confirmation shape today and it is not shared.

## User stories

1. As a resident, a tap that would cost me something (my session, my pledge, my rating)
   asks me first, says plainly what I lose, and lets me back out.
2. As the admin, cancelling a round asks the same way the resident's actions do.

## Acceptance criteria

- [x] AC1 — One `ConfirmSheet` primitive (built on `Sheet`, ADR-0022): title, one line of
      consequence, a danger confirm button with its own label ("Yes, log out"), a "Keep …"
      cancel; Escape/backdrop/cancel all back out; confirm runs the action and shows its
      pending label; an action error stays visible inside the sheet.
- [x] AC2 — Log out (Home header, Profile) → "Log out of this phone? You'll need a new code
      to sign in again." Confirm → `useSignOut`.
- [x] AC3 — Leave this round (pledge sheet) → "Leave this round? Your pledge of N units is
      withdrawn and the price for everyone may change." Stacked on the pledge sheet (Sheet
      already stacks: the top one answers Escape/Tab).
- [x] AC4 — Remove a rating → "Remove your rating? The vendor's average will no longer
      include it."
- [x] AC5 — Admin: Cancel round moves from the inline box to `ConfirmSheet` with the same words.
- [x] AC6 — Not confirmed (deliberately, reversible in one tap): withdraw an ask, deactivate
      a service/vendor, change a pledge count, switch notifications off.
- [x] AC7 — Tests: ConfirmSheet (opens, cancels, confirms, pending, error), each call site
      (the action runs ONLY after confirm; backing out runs nothing); gate green; V2; V3.

## Out of scope

- "Type the name to confirm" patterns; undo toasts.
