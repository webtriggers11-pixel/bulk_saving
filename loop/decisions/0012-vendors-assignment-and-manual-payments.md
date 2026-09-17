# ADR-0012: Global vendor list; assignment data on Round; per-participant manual payment flag

**Status:** Accepted
**Date:** 2026-09-17 · **Deciders:** Vivek (autonomous authorization), agent · **Work item:** FEAT-005

## Confidence

**Level:** Medium
**Basis:** Fits the BRIEF's manual-ops model (the admin negotiates offline, no gateway, no vendor
login) and resolves BRIEF open question 1 ("minimal vendor list, needed for ratings and accountability").
The per-participant payment granularity is a judgment call: it matches how money is actually
collected (each resident pays), but real operations may show that round-level tracking is enough.

## Research depth

**Depth:** Judgment call

- Decided autonomously per the owner's directive, consistent with ARCHITECTURE.md (global `Vendor`,
  lifecycle ASSIGNED/DELIVERED), ADR-0003 (tenancy), ADR-0011 (guarded transitions).

## Context and problem

To move a round from CLOSED_MET to ASSIGNED to DELIVERED, the admin must record who does the job and at
what negotiated price, and then track which residents have paid. We must pin where vendor and price live,
whether vendors are tenant-scoped, and how granular payment tracking is.

## Options considered

1. **Global Vendor table; vendorId, finalPrice, assignedAt and deliveredAt on Round; paymentCollectedAt on
   RoundParticipant** (chosen). Pro: no extra join entity; one guarded row-locked write stores the status and
   the assignment together; payments map to real collection; ratings (FEAT-007) can attach to the round and vendor.
   Con: widens Round, and a round can have only one vendor.
2. **Separate Job entity (1:1 with Round)** holding the vendor, price and delivery. Pro: separates the demand round
   from fulfilment. Con: an extra entity and a second place that implies status, with no v1 benefit. Deferred
   until a round needs several jobs.
3. **Free-text vendor name per round, round-level "paid" flag.** Pro: simplest. Con: no vendor
   accountability for ratings, and no per-resident collection tracking. Rejected (BRIEF R3).

## Decision

Option 1. Vendors are global (city-level), not society-scoped. `finalPrice` is integer ₹ per unit;
the amount a resident owes is `finalPrice × units`. Assign and deliver data are written inside
`RoundsService.transition()` in the same locked transaction as the status change. The payment flag is a
participant field (not a round status), so it is not a lifecycle transition. It is allowed only once a
vendor is assigned (ASSIGNED/DELIVERED/RATED), and the admin can undo it.

## Consequences

Good: a complete ops loop with minimal schema, consistent with the state machine, and ratings can
reference the vendor. Bad: moving to multi-vendor or split jobs later needs a migration to a Job entity.
The Vendor FK is `onDelete: Restrict`, so vendors are deactivated rather than deleted.

## Revisit trigger

A round needs more than one vendor or partial fulfilment; or ops show per-resident payment tracking
is unnecessary (or that partial payments are needed); or a vendor portal is added.
