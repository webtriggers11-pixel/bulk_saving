# ADR-0002: pnpm-workspace monorepo — NestJS backend + React PWA web + shared types

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (human-approved), agent · **Work item:** CHORE-001

## Confidence

**Level:** High
**Basis:** Industry-standard layout for a Nest + React product; matches the
framework's `apps/<layer>/` contract and BRIEF.md stack decision.

## Research depth

**Depth:** Judgment call

- Decision from established convention + the stack fixed in BRIEF.md, not from
  live research this session. The `stack-researcher` subagent can deepen if desired.

## Context and problem

Bulk Saving needs a NestJS API and a React PWA that share DTO/enum types (round
states, tier definitions). We need one repo layout that keeps app code out of the
Loop framework and lets both apps share types without duplication or drift.

## Options considered

1. **pnpm-workspace monorepo: `apps/backend` + `apps/web` + `packages/shared`** —
   pro: shared types, one install, matches `apps/<layer>/`; con: pnpm is another tool to learn.
2. **Two separate repos** — pro: simplest isolation; con: type sharing becomes copy-paste or a published package, drift-prone.
3. **npm/yarn workspaces** — viable; pnpm chosen for disk efficiency + strict, fast installs.

## Decision

One pnpm-workspace monorepo: `apps/backend` (NestJS), `apps/web` (React+Vite PWA),
`packages/shared` (TypeScript types). App code lives only under `apps/`.

## Consequences

Good: shared types, single verify entrypoint, clean framework/app separation.
Bad: contributors must have pnpm; workspace tooling adds minor config overhead.

## Revisit trigger

If a third deployable (e.g. a vendor app) or non-JS service is added, re-evaluate
whether the single monorepo still serves the team.
