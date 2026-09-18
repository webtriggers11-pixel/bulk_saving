# Plan CHORE-008

**Decisions:** ADR-0022 (screen primitives), ADR-0021 stands (tokens, themes).

## Order

1. **Primitives first** (T1–T2). Extract from the markup FEAT-011 already shipped, so the
   resident screens keep rendering what they render today — the refactor is provably a
   no-op before admin depends on it.
2. **Resident screens onto the primitives** (T3), one commit, gate green: this is where AC1
   is most at risk, so it happens before anything new is built on top.
3. **Admin artboards** (T4) — design before code, same as FEAT-011.
4. **Admin screens** (T5–T8), one per commit.
5. **Browser pass** (T9) against the real API as a super-admin.
6. **V2 → V3** (T10–T11).

## Design of the primitives (SOLID, concretely)

- **Single responsibility.** `PageHeader` places a title, an optional subtitle and an
  optional action; it does not know about routes. `EmptyState` renders a glyph, a heading,
  a line and an optional action; it does not know why the list is empty.
- **Open/closed.** Variation is a prop with a closed set of values (`surface`, `tone`,
  `size`), never a `className` that reaches inside. Callers add layout classes, not
  internals.
- **Liskov.** Every primitive takes the standard HTML props of the element it renders, so it
  can stand in for that element anywhere.
- **Interface segregation.** No god-component: `DataRows` renders rows; sorting, paging and
  selection are not invented because admin does not have them.
- **Dependency inversion.** Primitives depend on tokens, never on a feature; `features/*`
  depends on `components/ui/*` and never the reverse. A test asserts that direction.

## Test strategy

- Each primitive gets its own test (renders, accessible name, variant applied).
- A structural test asserts no `features/**` file re-declares a shape a primitive owns
  (AC2) and that `components/ui/**` imports nothing from `features/**` (dependency rule).
- The existing screen tests are the AC1 regression net and must pass untouched.
