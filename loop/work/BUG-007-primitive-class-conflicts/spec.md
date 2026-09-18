# BUG-007 — A primitive's base class and a caller's className silently fight; 13 overrides do nothing

**Status:** reproduced (autonomous) · **Priority:** P2 · **Opened:** 2026-09-19

## Symptom

Thirteen `className` overrides in the app have no effect, and nothing says so:

| Where | Asked for | Renders |
|---|---|---|
| `ProfilePage.tsx:92` (`profile-name`) | `text-[25px]` | 19px |
| `ServicesPage.tsx:61` (service hero) | `text-[25px]` | 19px |
| `HomePage.tsx:62` (resident name) | `text-[24px]` | 19px |
| `RoundsPage.tsx:252` (round title) | `text-headline` (21px) | 19px |
| `MyRequestsPage.tsx:126` | `text-[18px]` | 19px |
| `AdminNewRoundPage.tsx:139`, `AdminRoundDetailPage.tsx:133` | `rounded-control` on a 52px input skeleton | a 9999px stadium |
| `HomeSkeleton.tsx:27,32`, `CatalogSkeleton.tsx:15,19`, `RoundsSkeleton.tsx:25,37` | `rounded-chip` / `rounded-control` | 9999px |

## Cause

`cn` (`lib/utils.ts`) is a plain join, not tailwind-merge. When a primitive's base class and
a caller's `className` set the same CSS property, **both land** and the winner is decided by
the order Tailwind happened to emit them in — not by the caller.

- `CardTitle`'s base `text-title` is emitted at byte 31980, after every `text-[Npx]`
  (31085–31205) and after `text-headline` (31632). The base wins every time.
- `Skeleton`'s base `rounded-full` (22007) beats `rounded-chip` (21938) and
  `rounded-control` (21971), but loses to `rounded-inset` (22042) and `rounded-tile` (22076).
  So the same channel works or does not depending on which value you pick.

This is the third finding of this shape in two work items (FEAT-011's `fill-*`, CHORE-008's
`Card` padding). Each previous fix was narrower than the defect: a point fix for one
component and one property.

## Why it was invisible

jsdom applies no CSS, so no render test can see it. `check-css-classes.mjs` asks whether a
class *resolves to a rule* — both classes do. The browser pass had no baseline to compare
against. The `Card` padding guard added in CHORE-008 matches only `<Card`, only the padding
family, and only a double-quoted literal.

## Regression test (written first, must fail before the fix)

`primitives.test.tsx` renders every `components/ui` primitive with no `className`, reads the
class list it actually produces, and asserts that no caller in `features/**` passes a class
in the same CSS-property family as one of those base classes. Families: padding, font size,
border radius, gap, display. It reads the classes a component RENDERS rather than a list
someone maintains, so a new primitive is covered the day it is written.

## Fix

Give the two primitives a closed prop for the property their callers need to vary —
`CardTitle size` and `Skeleton radius` — and move the thirteen call sites onto it. Same shape
as the `Card padding` fix, now applied to the whole class of bug rather than one instance.

## Out of scope

`tailwind-merge` in `cn`. It is a dependency (CLAUDE.md requires owner approval) and it would
hide the problem rather than surface it: a silently-resolved conflict is still a component
whose internals are being reached into. The test makes the conflict a build failure instead.
