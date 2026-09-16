# ADR-0003: Shared-database, shared-schema multi-tenancy via `societyId`

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (human-approved), agent · **Work item:** FEAT-001

## Confidence

**Level:** High
**Basis:** Standard SaaS multi-tenancy approach for early-stage products; matches
the scale (10+ societies, growing) without premature isolation cost.

## Research depth

**Depth:** Judgment call

- Well-established pattern chosen from experience + BRIEF.md scalability requirement.

## Context and problem

The platform serves many building societies from one system, and must "scale from
the start" while keeping a lean 4–6 week MVP. Tenant data (rounds, jobs, offerings,
memberships) must be isolated per society, and one super-admin must query across all.

## Options considered

1. **Shared DB + shared schema + `societyId` on every tenant-scoped row** —
   pro: simplest to build/migrate, cheapest, easy cross-tenant admin queries;
   con: isolation is enforced in code, not by the DB — a missing filter leaks data.
2. **Schema-per-tenant** — pro: stronger isolation; con: migration + connection
   complexity, painful at MVP speed, overkill for current compliance needs.
3. **DB-per-tenant** — strongest isolation, highest ops cost; rejected for MVP.

## Decision

Shared database, shared schema. Every tenant-scoped table carries `societyId`.
Isolation is enforced at the service/repository layer from the authenticated
context — `societyId` is never trusted from client input for tenant-scoped access.
Design leaves room for a later `cityId`/`regionId` for multi-city.

## Consequences

Good: fastest path, cheap, scales to many societies, clean multi-city extension.
Bad: a forgotten `societyId` filter is a data-leak risk → mandatory review focus +
integration tests asserting cross-tenant isolation.

## Revisit trigger

If a society/enterprise client contractually requires physical data isolation, or
a compliance regime demands it, revisit for schema- or DB-per-tenant for those tenants.
