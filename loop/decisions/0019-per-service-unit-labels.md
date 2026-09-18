# ADR-0019: The unit label belongs to the global Service, stored singular and plural

**Status:** Accepted
**Date:** 2026-09-18 · **Deciders:** Vivek (asked and approved), agent · **Work item:** FEAT-010

## Confidence

**Level:** High (that the label belongs on Service, and that plural must be stored)
**Basis:** The round model already treats `Service` as the thing being bought and `units` as
the quantity of it; a unit's meaning is therefore a property of the service, and nothing else
in the model competes for it. Storing plural rather than deriving it is a settled lesson in
any product that shows counts — "1 flats" is the failure everyone hits once. Lower confidence
on `unitDescription` being sufficient to resolve scope disputes (see revisit).

## Research depth

**Judgment call**, grounded in a read of the existing model (`Service`, `ServiceOffering`,
`Round.unitsCount`, `RoundTier.threshold`, `Round.finalPrice`) and in where the string
"unit" is rendered today (5 web sites, 4 SMS templates). No external research.

## Context and problem

`units` is the currency of the whole mechanic: thresholds count units, tier prices are per
unit, and `amountDue = finalPrice × units`. Nothing defines what one unit of a given service
is. For AC Servicing it is self-evident; for Painting — a seeded service — it is not, and the
same will be true of any service measured by room, area or scope. The gap is a money gap, not
a wording gap: a resident commits, and is billed, per undefined unit.

## Options considered

1. **`unitLabel` + `unitLabelPlural` + optional `unitDescription` on the global `Service`**
   (chosen). Pro: one place; every DTO that already embeds a service summary carries it, so no
   screen needs a new request; it cannot disagree between societies; purely additive. Con: a
   society with a genuinely different convention cannot override it.
2. **On `ServiceOffering` (per society).** Pro: allows local convention. Con: the same
   service would mean different things in different societies, which makes cross-society
   demand aggregation on the admin dashboard incoherent — it already sums units across
   societies. No evidence anyone wants this. Rejected as a harder feature solving a
   hypothetical.
3. **On the `Round`.** Pro: maximum flexibility per campaign. Con: the admin would restate it
   every time they open a round, it could drift between rounds of the same service, and a
   resident comparing two rounds could see two different words for one thing.
4. **A single label, pluralised by appending "s".** Pro: one column. Con: wrong for "flat"→
   "flats" only by luck and wrong outright for anything irregular; and "1 units" / "1 flats"
   in a bill is precisely the kind of sloppiness that makes someone distrust the amount.
5. **A structured unit type enum** (`PER_APPLIANCE | PER_ROOM | PER_SQFT | PER_FLAT`). Pro:
   machine-readable, enables real quantity pickers later. Con: every new service shape needs a
   migration and a code change, which is the opposite of the "services are data" property the
   catalog deliberately has (ADR-0009). Deferred: if per-unit-type UI ever lands, this ADR is
   the thing to revisit.

## Decision

Option 1. Both label columns are **NOT NULL, backfilled to `'unit'` / `'units'`**, so nothing
that exists today changes behaviour and a service created without labels still renders
correctly — the feature degrades to exactly the current wording rather than to an empty
string. `unitDescription` is nullable and carries the scope sentence, because the label alone
("room") does not say what is included ("walls only, up to 12×12 ft"), and scope is the part
that actually causes arguments.

**No change to the mechanic.** Counting, thresholds, pricing, billing and every transition
are untouched (ADR-0004, ADR-0010, ADR-0012). This is a labelling layer over a model that
already works, which is why it can be P1 and low-risk at once.

## Consequences

Good: a resident sees what they are committing to and what it includes; the admin's
negotiated per-unit price is unambiguous; the SMS stops speaking in jargon; adding a service
with a new unit remains a data operation, no code.
Bad: three more columns on `Service` and four more strings to get right per service; the admin
can now enter a label that disagrees with how the vendor actually quotes (a data-quality
problem where there was previously no way to be wrong at all); and a society with its own
convention has no override.

## Revisit trigger

- A society or vendor genuinely prices the same service by a different unit → move to option 2
  (per-offering override), and fix the dashboard's cross-society unit summing at the same
  time, because that is what makes option 2 hard.
- Anyone wants unit-aware input (a room counter, a sq-ft slider, a per-unit photo) → introduce
  the structured unit type from option 5; the free-text label cannot drive UI.
- Scope disputes with vendors despite `unitDescription` → the scope needs to be structured
  (what's included / excluded), not one sentence.
