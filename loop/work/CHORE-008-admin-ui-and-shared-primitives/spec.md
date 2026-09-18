# CHORE-008 — Every remaining screen on the design system, and the primitives that stop the repetition

**Status:** specced (autonomous) · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-19

## Problem / Why

FEAT-011 redesigned the six resident screens and left `/admin/*` on default Tailwind —
`bg-slate-50`, `rounded-md`, `text-teal-800`. The two halves of one product now look like
two products, and the admin half is the one the owner uses every day.

The second problem is in the resident half. FEAT-011 shipped the design by writing it out
per screen: four hand-rolled empty-state cards, five page headers, three "fact tile" pairs,
three monogram blocks, four loading skeletons that each re-declare the same shapes. Every
one of those is the same idea typed again. That is what makes the next change expensive and
the one after that inconsistent.

## Scope

1. **Shared screen primitives** (`components/ui/`), each with one job:
   `PageHeader`, `EmptyState`, `FactTile`, `StatCard`, `Field`, `Monogram`, `AmbientGround`,
   `DataRows`. Resident screens are refactored onto them; admin screens are built from them.
2. **Admin screens redesigned** on the existing token layer: `AdminLayout`, dashboard,
   new round, round detail, vendors, `StatusBadge`.
3. **The canvas gains the admin artboards** it never had, so the stored design covers every
   screen in the product rather than six of ten.

## Out of scope

- New behaviour of any kind. Same routes, API calls, query keys, copy, testids, validation.
- New tokens. If a value is missing, it is added to `theme.css`, not to a component.
- CHORE-006 (admin has no services page) stays open and separate.

## Acceptance criteria

1. **AC1 — no behavioural change.** Every existing test passes unmodified, except one that
   asserts a style literal (each such edit is named in its commit).
2. **AC2 — nothing hand-rolled twice.** No screen declares its own page header, empty state,
   fact tile, stat card, monogram or field wrapper; a test asserts the shapes are imported,
   not re-typed.
3. **AC3 — admin is on the system.** No `slate-*`/`teal-*`/hex/rgba in `features/admin`;
   the existing AC2 colour test drops its admin exemption.
4. **AC4 — one visual language.** Admin and resident share the same surfaces, radii, focus
   ring, motion and icon family. The blur budget (≤3 per screen) holds on admin too.
5. **AC5 — every screen exists in the canvas**, stored in this folder.
6. **AC6 — proven in a browser**, signed in as a super-admin against the real API, not only
   in jsdom.

## Risks

- **Admin tables at 1280px.** The resident system is phone-first; a five-column table needs
  a density that glass cards do not give. Mitigation: `DataRows` is a list-of-rows primitive
  that collapses to cards under `md`, rather than forcing tables into cards.
- **Refactoring resident screens risks AC1.** Mitigation: primitives are extracted with the
  markup they already produce, one screen per commit, gate between each.
