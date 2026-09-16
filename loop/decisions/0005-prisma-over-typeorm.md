# ADR-0005: Prisma as the ORM (over TypeORM)

**Status:** Accepted
**Date:** 2026-09-16 · **Deciders:** Vivek (human-approved), agent · **Work item:** CHORE-001

## Confidence

**Level:** Medium
**Basis:** Prisma's type safety + migration DX are strong for a small-team MVP;
the main trade-off (less Nest-native DI integration) is well understood and minor.

## Research depth

**Depth:** Judgment call

- Chosen from experience and the founder's explicit selection during `architect:`.
  Not from live version-specific research this session.

## Context and problem

The NestJS backend needs a type-safe data layer over PostgreSQL with clean
migrations, usable in atomic transactions for the round-concurrency path (ADR-0004),
buildable fast in a 4–6 week MVP.

## Options considered

1. **Prisma** — pro: excellent TypeScript types, `prisma migrate`, great DX,
   first-class `$transaction`; con: not decorator/DI-native to Nest (wrapped in a
   `PrismaService`), some advanced Postgres features need raw queries.
2. **TypeORM** — pro: Nest-native (repositories via DI, decorators); con: more
   boilerplate, migration ergonomics weaker, historically rougher type safety.

## Decision

Use Prisma, exposed through an injectable `PrismaService`. All DB access goes
through a service (never Prisma in controllers).

## Consequences

Good: strong types shared with `packages/shared`, fast iteration, clean migrations.
Bad: a thin wrapper around Nest DI; occasional raw SQL for advanced needs.

## Revisit trigger

If we hit repeated cases where Prisma can't express needed Postgres features, or
Nest DI integration friction becomes costly, re-evaluate TypeORM / Kysely.
