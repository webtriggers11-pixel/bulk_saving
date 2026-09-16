# ADR-0006: Docker Compose for local Postgres + Redis in development

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (human-approved), agent · **Work item:** CHORE-001

## Confidence

**Level:** High
**Basis:** Standard, low-risk way to give every developer identical Postgres/Redis
versions; explicitly chosen by the founder.

## Research depth

**Depth:** Judgment call

- Common practice; chosen from experience + human selection, no live research needed.

## Context and problem

Development needs Postgres 16 + Redis 7 matching what production will run. Local
installs drift between machines; cloud dev instances add accounts and cost.

## Options considered

1. **Docker Compose** — pro: reproducible, version-pinned, easy teardown; con: requires Docker.
2. **Local installs (Homebrew)** — pro: no Docker; con: version/config drift.
3. **Cloud dev instances** — pro: no local setup; con: accounts + possible cost.

## Decision

A `docker-compose.yml` at the repo root provides Postgres 16 + Redis 7 for local dev.
Connection details come from env vars consumed by the backend config.

## Consequences

Good: identical infra everywhere, trivial reset. Bad: Docker must be installed;
container startup adds a few seconds to first-run.

## Revisit trigger

If the team standardises on a cloud dev DB, or Docker becomes unavailable in the
dev environment, revisit.
