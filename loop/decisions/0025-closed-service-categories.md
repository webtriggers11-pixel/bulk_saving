# ADR-0025: Service categories are a closed list in @bulk/shared; Bulk Staples joins it as a pilot

**Status:** Accepted
**Date:** 2026-10-17 · **Deciders:** Vivek ("do it", approving the staples pilot), agent · **Work item:** FEAT-014

## Confidence

**Level:** High (the list mechanism) · Medium (the staples pilot)
**Basis:** A closed enum validated at the DTO is the standard cure for free-text drift and
costs one array edit to extend. The Medium is product, not code: whether pooled demand for
staples behaves like pooled demand for services is exactly what the pilot is for.

## Research depth

**Judgment call.** No library choice; the alternatives below are all in-repo patterns.

## Context and problem

`Service.category` is free text (FEAT-002). With an admin form about to exist, every typo
becomes a new section of the resident catalog. The test fixtures already hold "Home" next
to "Home Care".

## Options considered

1. **Closed list as a shared constant, validated with `@IsIn`; DB column stays a string** —
   chosen. Adding a category is a one-line change plus a deploy, which is the right friction
   for something that reshapes the resident catalog.
2. **A `Category` table with admin CRUD** — rejected for v1: a screen, a migration and a
   foreign key to solve a problem six strings solve. Revisit if categories ever need
   per-society ordering, icons or translations.
3. **A Postgres enum** — rejected: a migration per new category, and enum changes inside
   transactions are awkward (FEAT-004's migration already had to drop an index to alter one).
4. **Free text with a datalist of existing values** — rejected: suggests, does not prevent.

## Decision

- `SERVICE_CATEGORIES = ['Appliances', 'Home Care', 'Renovation', 'Utilities', 'Vehicle',
  'Bulk Staples']` in `@bulk/shared`. Create requires one; update validates one if sent.
- The column stays `String`, and `AdminServiceDto.category` stays `string`: a row written
  before this ADR still reads, and can still be edited without touching its category.
- The web app cannot import runtime values from `@bulk/shared` (CommonJS; see
  `rating-cap.test.ts`), so it holds a copy pinned by a test that fails on any drift.
- **Bulk Staples** is a category, not a new domain: a staple is a service whose unit is a
  pack ("25 kg bag"). The round mechanic, thresholds, tiers and manual payment are reused
  unchanged. Baskets, fresh produce, inventory and delivery slots are out.

## Consequences

- BRIEF's scope widens from "home services" to "home services + bulk staples (pilot)".
- A deploy is needed to add a category. Accepted.
- Staples will expose what services do not: delivery is to the gate, so "delivered" means
  handed over, and a rating is about the product as much as the vendor.

## Revisit triggers

- More than ~10 categories, or a request for per-society category ordering → option 2.
- After 3 staples rounds close: did they fill like services did? If not, drop the category.
