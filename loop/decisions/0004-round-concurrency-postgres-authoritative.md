# ADR-0004: Postgres is authoritative for round unit counts; Redis is display-only

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (human-approved), agent · **Work item:** FEAT-003

## Confidence

**Level:** High
**Basis:** Atomic single-row updates / row locking in Postgres are the canonical,
well-proven solution to concurrent counter increments crossing thresholds.

## Research depth

**Depth:** Judgment call

- Standard concurrency pattern from experience. Given this is the highest-risk code
  in the product, the `stack-researcher` subagent could validate the exact Prisma
  transaction/isolation approach before implementation if desired.

## Context and problem

Residents join a round by adding N **units**. Crossing a **tiered threshold** changes
the price for everyone. Concurrent joins near a threshold must never over-count,
under-count, or oversell a tier. Redis is fast but not a durable source of truth.

## Options considered

1. **Postgres authoritative via atomic transaction** — join runs
   `round.update({ where: { id, status: 'OPEN' }, data: { units: { increment: qty } } })`
   inside `prisma.$transaction`, then recomputes tier/price from the returned count.
   Redis used only for live-counter reads + OTP/rate-limit. Pro: correct under
   concurrency, durable; con: a hot round serializes on one row (acceptable at our scale).
2. **Redis-authoritative counters (INCR)** — fast, but durability + reconciliation
   with Postgres add complexity and a window for divergence. Rejected as source of truth.
3. **Application-level locks** — brittle across instances. Rejected.

## Decision

PostgreSQL is the single source of truth for unit counts and round state; count
mutations happen only inside atomic DB transactions. Redis is display/cache and
rate-limiting only, never authoritative for units or state.

## Consequences

Good: correctness guaranteed under concurrent joins; durable; simple mental model.
Bad: a single very hot round contends on one row — fine now; see revisit trigger.

## Revisit trigger

If a single round must sustain a write-contention level where single-row updates
become a bottleneck (very high simultaneous joins), introduce sharded counters or
a queue-serialized join path.
