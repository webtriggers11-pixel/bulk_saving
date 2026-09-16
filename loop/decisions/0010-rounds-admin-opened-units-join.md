# ADR-0010: Rounds are admin-opened with preset tiers; residents join with units; one open round per (society, service)

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (autonomous authorization), agent · **Work item:** FEAT-003

## Confidence

**Level:** Medium
**Basis:** Cleanest coherent model for v1 that fits the chosen "window + threshold"
mechanic and the manual-ops / admin-negotiates-pricing reality. The resident-initiated
alternative is viable but pushes pricing questions upstream.

## Research depth

**Depth:** Judgment call

- Decided autonomously per the owner's directive to run the loop without per-step approval,
  using the brainstorm decisions (window+threshold, units-not-people, tiered pricing).

## Context and problem

A round needs known tiered prices upfront to show "unlocks ₹X at N units". Pricing comes
from a vendor deal the super-admin arranges (manual ops). Who creates rounds, and how many
can be open per service, must be pinned before building the join mechanic.

## Options considered

1. **Admin-opened rounds + resident join** (chosen) — SUPER_ADMIN opens a round for a
   (society, service) with deadline + tiers; residents join with units. Pro: pricing stays
   under admin/vendor control, matches the mechanic + mockup, clean concurrency model; con:
   less spontaneous than pure resident-driven demand.
2. **Resident-initiated rounds** — first requester starts a round. Pro: maximal
   resident-driven; con: where do tiers/prices come from before a vendor deal? Pushes an
   unsolved pricing question into v1.
3. **Demand signalling only (no price)** — residents express interest, admin later converts
   to a deal. Pro: matches raw brainstorm; con: loses the upfront "unlocks ₹X" urgency the
   chosen mechanic depends on.

## Decision

SUPER_ADMIN opens rounds (deadline + ascending unit-threshold tiers). Residents join with
units (≥1), can update/leave while OPEN. At most one OPEN round per (society, service).
Current price = price of the highest tier whose unit threshold is met. Unit count is
authoritative in Postgres and mutated atomically (ADR-0004).

## Consequences

Good: prices are real and known; concurrency is simple and correct; admin controls the deal.
Bad: residents can't spontaneously start a round in v1 (needs an admin to open it).

## Revisit trigger

If societies want to self-start demand before a deal exists, add a resident "request a
service" signal that notifies the admin to open a round (backlog item), possibly superseding
this ADR's "admin-opened only" stance.
