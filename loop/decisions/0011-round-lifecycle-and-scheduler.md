# ADR-0011: Round lifecycle state machine + BullMQ deadline scheduler

**Status:** Accepted
**Date:** 2026-09-17 · **Deciders:** Vivek (autonomous authorization), agent · **Work item:** FEAT-004

## Confidence

**Level:** High
**Basis:** The lifecycle is already prescribed in ARCHITECTURE.md; BullMQ delayed jobs
are the established scheduler (already wired in the scaffold). Only the "met" rule and
the guarded-transition mechanics are newly pinned.

## Research depth

**Depth:** Judgment call

- Decided autonomously per the owner directive, consistent with ARCHITECTURE.md and ADR-0004.

## Context and problem

Rounds must close at their deadline without manual intervention and progress through a
real lifecycle so demand can be acted on. FEAT-003 left status as OPEN|CLOSED with manual
close only. We must pin the status set, the "did the group succeed" rule, and how closing
is scheduled and kept correct under concurrency.

## Options considered

1. **Full enum + guarded `transition()` in RoundsService + BullMQ delayed job per round** (chosen).
   Pro: matches ARCHITECTURE, one owner for state, reliable deadline firing, atomic under the
   ADR-0004 row lock; con: enum migration + job lifecycle (cancel/replace on change) to manage.
2. **Cron sweep** that periodically scans for past-deadline OPEN rounds. Pro: no per-round job;
   con: up-to-1-interval latency, extra scanning; less precise. Rejected for v1 precision (kept as a possible fallback).
3. **Close only on read** (lazy) — close a round when someone next fetches it. Pro: trivial;
   con: a round with no readers never closes; demand never actioned. Rejected.

## Decision

- Status: OPEN → CLOSED_MET | CLOSED_EXPIRED → ASSIGNED → DELIVERED → RATED, + CANCELLED
  (from any pre-DELIVERED state). A single guarded `transition()` in RoundsService enforces the
  legal-transition map (illegal → INVALID_ROUND_TRANSITION); all status writes go through it.
- "Met" at deadline: CLOSED_MET iff unitsCount >= lowest tier threshold, else CLOSED_EXPIRED.
- Scheduling: on round create, enqueue a BullMQ delayed job at the deadline; a RoundCloserProcessor
  performs the terminal OPEN→CLOSED_* transition atomically under the round row lock, idempotently
  (no-op if already non-OPEN). Manual close routes through the same logic; cancel/change supersedes the job.

## Consequences

Good: rounds close reliably and precisely; the state machine is coherent and centrally guarded;
concurrency-safe via the existing row lock. Bad: job lifecycle must track deadline changes; a
dropped Redis job would leave a round open (mitigation/fallback: a periodic sweep can be added later).

## Revisit trigger

If "met" should depend on a configurable target (not the lowest tier), or if job reliability
needs a safety net, add a periodic reconciliation sweep for past-deadline OPEN rounds.
