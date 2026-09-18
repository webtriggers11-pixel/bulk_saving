# FEAT-010 — Per-service unit labels ("2 rooms", not "2 units")

**Status:** specced (autonomous) · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-18

## Problem / Why

The round mechanic counts "units", and nothing anywhere defines what a unit IS for a given
service. For AC Servicing a unit is obviously one AC. For **Painting** — already a seeded
service at ₹15,000 — it is undefined: a room? a wall? the whole flat?

That is not cosmetic, it is money and commitment:

- a resident pledging "2 units" of Painting has committed to an undefined quantity;
- the tier thresholds ("5 units unlocks ₹700") do not mean anything a resident can check;
- the admin negotiates a **per-unit** `finalPrice` for a quantity nobody has defined, and
  `amountDue = finalPrice × units` bills against it;
- the SMS says "2 units at ₹3,500/unit", which reads as jargon and is unverifiable.

The V2 reviewer flagged "units is internal jargon in a resident-facing SMS" for a separate
reason; the owner's question about Painting exposed the same gap at the domain level. The
mechanic is correct for countable services and under-specified for anything measured by
room, area or scope.

## Decisions baked in (ADR-0019)

- The label lives on the **global `Service`**, not on `ServiceOffering`: a unit of Painting
  means the same thing in every society. Per-society variation would be a different, harder
  feature (local pricing conventions) with no evidence anyone needs it.
- **Singular and plural are stored explicitly** (`unitLabel`, `unitLabelPlural`), not derived
  by appending "s". "1 flats" / "1 sq fts" are exactly the kind of wrongness that makes a
  resident distrust a bill.
- Both are **NOT NULL with a `'unit'` / `'units'` backfill**, so every existing row and any
  service created without a label keeps rendering sensibly. No behaviour is removed.
- An optional **`unitDescription`** carries the scope sentence ("One room, walls only, up to
  12×12 ft") — that is what actually resolves the Painting ambiguity, since a label alone
  does not say what is included.
- **No change to the mechanic.** `unitsCount`, thresholds, `finalPrice × units` and every
  transition stay exactly as they are (ADR-0004, ADR-0010, ADR-0012). This is a labelling
  layer over a model that already works.

## User stories

1. As a resident, I see "2 rooms" rather than "2 units", so I know what I am committing to.
2. As a resident, I can read what one unit includes before I join.
3. As a resident, my SMS says "2 rooms of Painting at ₹3,500/room".
4. As a super-admin, the round, tier and payment screens name the unit, so a negotiated
   per-unit price is unambiguous.
5. As a super-admin, I set the unit label and scope when I create or edit a service.

## Acceptance criteria (testable — this IS the definition of done)

**Schema + contract**
- [ ] Migration adds `Service.unitLabel` and `Service.unitLabelPlural`, both NOT NULL,
      backfilled to `'unit'` / `'units'` for existing rows, plus nullable `unitDescription`.
      Additive; applies cleanly to existing data.
- [ ] `RoundServiceSummary` (and therefore every round DTO the resident and admin already
      receive) carries the three fields, so no screen needs a second request.
- [ ] `POST`/`PATCH /admin/services` accept and validate them: label 1–24 chars,
      description ≤ 140; label defaults applied when omitted.

**Resident**
- [ ] The join control, pledge line, live counter and My Requests all use the service's
      label with correct singular/plural ("1 room", "2 rooms").
- [ ] Price reads "₹3,500 / room".
- [ ] The scope sentence is shown where a resident chooses to join, when present.

**Admin**
- [ ] Round detail, tier inputs and participant rows name the unit.
- [ ] **Dashboard demand does NOT name a unit — corrected AC.** `unitsPledged` per society
      sums units ACROSS services, so there is no single word for it: 3 rooms of painting and
      2 ACs are "5". Labelling it with any one service's unit would be wrong. The column now
      says "Units (mixed)" and the card says the counts are not comparable. This is the same
      incoherence ADR-0019 cites as the reason per-society labels were rejected; it applies
      to cross-SERVICE sums too, and the original AC asked for something false.
- [ ] **CORRECTED AC — there is no admin service form to add fields to.** The web app has
      no services page at all (`apps/web/src/features/admin/` has vendors, rounds and the
      dashboard; `admin.api.ts` exposes only `GET /admin/services`), so a master service can
      only be created or edited through the API. The unit fields are therefore validated and
      accepted on `POST`/`PATCH /admin/services`, and that is the whole deliverable here.
      The missing services UI predates FEAT-010, is registered as CHORE-006, and is not this
      work item's to build — the original AC asked for something that does not exist.

**Notifications**
- [ ] ROUND_JOINED, ROUND_CLOSING_SOON, ROUND_CLOSED_MET and ROUND_ASSIGNED use the label.
      A service with no explicit label still renders "unit(s)" and never an empty string.

**Verification**
- [ ] `bash scripts/verify.sh` exits 0 (lint → typecheck → build → tests).
- [ ] Seed gives the five seeded services real labels, including Painting → room.
- [ ] `node scripts/e2e-smoke.mjs` still passes, with a check that the label reaches the API.

## Out of scope

- Per-society or per-round unit overrides (ADR-0019 revisit trigger).
- Quantity pickers with units of measure (sq ft sliders, room counters with floor plans).
- Changing how units are counted, priced or billed — labels only.
- Translation / i18n of labels (English only, as everywhere else in v1).
- Per-service custom fields beyond the unit (colour choice, brand preference, photos).

## Open questions

- Should `unitDescription` be required for a service whose label is not "unit"? → Not
  enforced in v1; the admin form nudges but does not block. Revisit if scope disputes appear.
