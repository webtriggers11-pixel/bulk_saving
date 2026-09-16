# ADR-0009: Catalog = global Service master + per-society ServiceOffering

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (human-approved), agent · **Work item:** FEAT-002

## Confidence

**Level:** High
**Basis:** Standard catalog/availability split; matches the multi-tenant model (ADR-0003)
and the founder's choice to curate services per society.

## Research depth

**Depth:** Judgment call

## Context and problem

Residents browse services available in their society before starting a group-buy.
Services are largely common across societies, but the founder wants the ability to
control which services each society sees (and an indicative price per society) without
duplicating service definitions.

## Options considered

1. **Global `Service` master + per-society `ServiceOffering` join** (chosen) — one
   definition per service type; a `(societyId, serviceId, enabled, indicativePrice?)` row
   controls availability per society. Pro: no duplication, curatable per tenant, clean
   join for the resident catalog; con: an extra table + seed step to enable offerings.
2. **Global catalog, no offering table** — every society sees all active services.
   Simplest, but no per-society curation; adding it later needs a migration + backfill.
3. **Society-owned service copies** — each society has its own service rows. Maximum
   flexibility, heavy duplication and drift; rejected.

## Decision

Global `Service` master (super-admin managed) + per-society `ServiceOffering`
(`@@unique([societyId, serviceId])`). Resident catalog = `enabled` offerings joined to
`active` services, scoped by `societyId` from the JWT. Seed enables all master services
for seeded societies to keep v1 friction-free.

## Consequences

Good: no service duplication, per-society control, future multi-city friendly.
Bad: admin must enable offerings (mitigated by seed default-enable); one extra join.

## Revisit trigger

If per-society curation proves unused (all societies always get everything), collapse
to the global model; if offerings need richer per-society config (scheduling, vendor
pinning), expand the ServiceOffering row.
