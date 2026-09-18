# ADR-0022: Screen shapes are primitives in `components/ui`, and features may not re-type them

**Status:** Accepted
**Date:** 2026-09-19 · **Deciders:** Vivek (asked for a complete redesign, SOLID, no repetition), agent · **Work item:** CHORE-008

## Confidence

**Level:** High
**Basis:** The repetition is measurable rather than aesthetic — four empty-state cards, five
page headers, three fact-tile pairs and three monogram blocks, all written out separately in
FEAT-011, before admin adds a fourth copy of each. The direction (features depend on ui, never
the reverse) is the one dependency rule this codebase can enforce with a test.

## Research depth

**Judgment call**, grounded in a read of every screen FEAT-011 shipped and of the four admin
pages. No external research; this is a factoring decision, not a technology one.

## Context

FEAT-011 proved the design by writing it per screen. That was right for one pass — the shapes
were still being decided — and it is wrong to keep: the admin half is about to need the same
shapes, and a fifth copy is where they stop agreeing.

## Decision

1. **Every recurring shape becomes a primitive** in `components/ui`: `PageHeader`,
   `EmptyState`, `FactTile`, `StatCard`, `Field`, `Monogram`, `AmbientGround`, `DataRows`.
2. **Variation is a closed prop, not a className.** `surface="glass" | "solid" | "tint"`,
   `tone`, `size`. A caller may pass `className` for *placement* (margins, grid spans) and
   never for internals. This is what keeps two callers of the same primitive looking related.
3. **Dependencies point one way**: `features/*` → `components/ui/*`. A primitive that needs
   to know about rounds or vendors is not a primitive; it belongs to the feature. Asserted by
   test, because this is the rule that rots first.
4. **Admin uses the same primitives as resident.** Not a parallel "admin design" — the same
   surfaces, radii, focus ring, motion and icons, with density the only difference (admin
   rows are tighter and wider; the tokens are identical).
5. **Extraction is a no-op first.** Each primitive is extracted with the markup it already
   produces and lands with the screen tests untouched, so the refactor is provably behaviour-
   preserving before anything new is built on it.

## Two exceptions, recorded rather than quietly taken

1. **The participants list stays a real `<table>`.** It is genuinely tabular — six
   columns, one row per resident — the unit word lives in a `columnheader` that
   FEAT-010 asserts, and a screen reader reads a table better than a list of rows.
   `DataRows` is for records that are *not* a table. The cost is named: that one
   surface scrolls sideways on a phone.
2. **`lib` may not import `features` either.** The rule was written for
   `components/`, and `lib/api.ts` was importing the auth store the whole time. The
   API client now depends on a `SessionPort` that `features/auth` fills — the
   dependency points from the feature into `lib`, not the other way.

## Consequences

- Positive: one place to change a shape; a new screen is assembled rather than drawn; the
  admin half stops being a second product.
- Positive: the structural test makes "someone re-typed an empty state" a build failure
  rather than a code-review opinion.
- Negative: indirection — a screen no longer shows you its own markup. Mitigated by keeping
  primitives small, single-purpose and documented in `DESIGN-SYSTEM.md`.
- Negative: a closed prop set is less flexible than a className. That is the point, and it
  will occasionally mean adding a variant instead of a one-off. Adding the variant is the
  correct outcome.

## Revisit triggers

- A primitive grows a third boolean prop that changes its layout → it is two primitives.
- Admin gains a genuine table (sorting, paging, selection) → `DataRows` is the wrong shape
  and a real table primitive is warranted.

## Alternatives considered

- **Leave admin as it is.** Cheapest, and it leaves the owner's daily surface looking unbuilt
  next to the resident app it links to.
- **A second, denser admin design system.** Two systems is how the product ends up with two
  looks and twice the maintenance, for a difference that is density, not language.
- **A component library (shadcn CLI, Radix).** A dependency and a migration riding on a
  redesign; STACK.md already keeps it as a later option, and ADR-0008 stands.
