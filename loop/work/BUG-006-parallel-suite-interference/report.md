# BUG-006 — The backend gate could not pass twice in a row

**Status:** done · **Priority:** P1 · **Owner:** Vivek · **Opened:** 2026-09-18 · **Closed:** 2026-09-18

## Symptom

`bash scripts/verify.sh` run back-to-back kept disagreeing with itself, blocking V3 on two
work items. A *different* test failed almost every time:

| Occurrence | Failing test | Error |
|---|---|---|
| FEAT-010 V3 run 1 | `admin-dashboard` assign from CLOSED_EXPIRED | 401, expected 409 |
| CHORE-007 V3 run 2 | `round-lifecycle` near-immediate delayed job | timing |
| earlier (FEAT-009) | `cors` preflight ×4 | 404 |
| earlier (CHORE-002) | `rounds-admin` ×5 | 404 / 500 |
| earlier (FEAT-006) | `notifications` reconciler | job consumed elsewhere |

Every one passed when its suite ran alone. That is the signature of shared mutable state, not
a bug in any of those features — which is why each was individually mystifying.

## Root cause

Jest ran test **files in parallel workers**, and every integration suite shares **one**
Postgres and **one** Redis (ADR-0006). So, concurrently:

- suites created and deleted rows another suite was asserting on;
- **BullMQ workers from different suites consumed each other's jobs** — a reconciler test's
  job completed inside a worker belonging to a different test app;
- boot-time reconcilers in one suite's app acted on another suite's fixture rounds;
- timing-sensitive tests (a real delayed job firing in ~1.5s) were starved of CPU.

This was recorded as a P2 ("dedicated test DB/Redis") back in FEAT-004 and treated as
tidiness. It was not: it left the single verification gate unable to give the same answer
twice, which is the one property a gate must have.

## Fix

`jest --runInBand`, with `maxWorkers: 1` and the reasoning recorded in `jest.config.js`.
Suites now run one at a time: they still share the database, but never concurrently.

**Cost: about 2 seconds.** The backend suite went 16.0s → 18.1s — the parallelism was
producing contention, not speed.

## Evidence

**Five consecutive `verify.sh` runs, all exit 0, all identical**: backend 317 tests /
24 suites, web 182 / 35 files. Before the change, back-to-back pairs failed roughly half the
time, each with a different test.

## What this does NOT fix

- **BUG-005** (the 401) is *mitigated*, not explained. Serialisation removes the interference
  that almost certainly caused it, but the precise mechanism was never proven, so its two
  hypotheses stay on record — if a 401 recurs under serial execution, neither was the cause.
- Suites still share one database, so a test that leaks rows still affects later suites in the
  same run. True isolation (a database per worker, or a schema per suite) is the deeper fix and
  is worth doing before the suite grows much larger.
- CI invokes the repo's test script, so it inherits this automatically.
