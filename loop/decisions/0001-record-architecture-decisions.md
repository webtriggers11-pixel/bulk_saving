# ADR-0001: Record architecture decisions

**Status:** Accepted · **Date:** <bootstrap date> · **Deciders:** <team>

## Context and problem

Agent sessions are stateless; chat transcripts are lost. Without a durable
record of *why* choices were made, every session re-litigates settled decisions.

## Decision

Every architecturally significant decision — including micro-decisions like
naming, folder layout, test strategy, dependency policy — becomes one file in
`loop/decisions/NNNN-title.md` using the 0000-template. ADRs are immutable once
Accepted; a change of mind creates a superseding ADR.

## Consequences

Agents read `loop/decisions/` at session start and stop proposing rejected
approaches; humans get an audit trail. Costs ~5 minutes per decision.
