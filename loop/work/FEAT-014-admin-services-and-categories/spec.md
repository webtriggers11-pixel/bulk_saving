# FEAT-014 — Admin services page, a closed category list, a wider catalog, and a staples pilot

**Status:** done · **Priority:** P1 · **Opened:** 2026-10-17 · **Closed:** 2026-10-17 · **Asked by:** owner
("check admin panel category like grocery, other services and all" → "do it")
**Supersedes:** CHORE-006 (no admin services page) · **Decisions:** ADR-0025

## Why

1. The admin cannot add, edit, switch off, or offer a service to a society without calling
   the API by hand (CHORE-006). "Services are data, not code" (ADR-0009) is false in practice.
2. `category` is free text. Nothing stops "Home" and "Home Care" from becoming two groups,
   and the test fixtures already contain both.
3. The catalog has five services; the owner wants more to offer residents.
4. The owner approved piloting grocery — as **bulk staples only** (single product, fixed
   pack, one delivery to the gate). This is a recorded change to BRIEF's "home services"
   scope; baskets, fresh produce, inventory and delivery slots stay out.

## Acceptance criteria

- **AC1** `SERVICE_CATEGORIES` (Appliances, Home Care, Renovation, Utilities, Vehicle, Bulk
  Staples) lives in `@bulk/shared`; create/update reject any other category with 400.
- **AC2** `GET /admin/services` returns each service's per-society `offerings`.
- **AC3** `/admin/services` page (nav item "Services"): services grouped by category; add
  form; inline edit of name, category (a select — never free text), description, unit
  label/plural/scope; activate/deactivate; per-society on/off + indicative price.
- **AC4** Client validation mirrors the server: name 1–120, slug pattern (derived from the
  name on create), description 1–2000, unit labels paired and ≤16, scope ≤140. The web
  copy of the category list and caps is pinned to `@bulk/shared` by a test.
- **AC5** Seed: 18 new services across the six categories (3 of them Bulk Staples), offered
  in both societies; demo seed adds a staples round and a water-tank round, plus a wholesaler.
- **AC6** Resident catalog cards get a glyph for the new categories (car, water, basket),
  not the generic fallback.

## Out of scope

Deleting services (they are referenced by rounds; deactivate instead). Image upload. A
category admin screen — the list is closed by design (ADR-0025). Grocery baskets/carts.
