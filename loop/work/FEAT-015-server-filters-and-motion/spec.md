# FEAT-015 — Server-side filters on every list, and a modern, animated filtering UI

**Status:** in-progress · **Priority:** P1 · **Opened:** 2026-10-17 · **Asked by:** owner
("We need server side filters and all with best UI/UX modern one microinteraction and
animations also") · **Decisions:** ADR-0026

## Why

Every list filters on the client or not at all. Rounds has two server filters (status,
society) behind plain selects held in component state, so a refresh loses them. Services
(23 rows) and Vendors have none, and the resident catalog cannot be searched.

## Acceptance criteria

- **AC1 — server filters.** All validated query DTOs, all case-insensitive search:
  - `GET /admin/services?q&category&status=active|inactive&offeredIn=<societyId>`
  - `GET /admin/vendors?q&category&status`
  - `GET /admin/rounds?status&societyId&q&category` (q: service, society or vendor name)
  - `GET /catalog?q&category` — still scoped to the caller's society only (ADR-0003)
  `q` is trimmed, blank = no filter, ≤ 80 chars. Unknown status → 400.
- **AC2 — filters live in the URL.** Refresh and share keep them; changing a filter
  replaces history rather than pushing an entry per keystroke.
- **AC3 — no flicker.** The previous results stay on screen (dimmed) while the next
  load; search is debounced (250 ms); a result count animates to the new number.
- **AC4 — no-match state.** "No services match" with the active filters named and a
  "Clear filters" action — distinct from the true empty state.
- **AC5 — primitives.** `SearchField` (icon, clear button), `FilterChips` (single-select,
  radio semantics, arrow-key navigation), `Switch` (role=switch) — in `components/ui`,
  covered by the class-conflict and primitive guards.
- **AC6 — micro-interactions.** Chip and switch spring on press; a "Saved" tick pops
  after a successful admin save; new rows rise in (existing rows do not replay);
  Activate/Offer become switches. Every one is a named class in theme.css and collapses
  under `prefers-reduced-motion`.
- **AC7 — screens.** Admin Services, Vendors, Dashboard rounds list; resident Services.

## Out of scope

Pagination (lists are bounded: rounds already capped at ADMIN_ROUNDS_LIMIT); sorting;
saved filter presets; a Postgres trigram index (ADR-0026 revisit trigger).
