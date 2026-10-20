# BUG-022 — `useWhatsAppLogin` polling test times out 1 run in N (3 sightings: FEAT-028's V1, a parallel vitest run, BUG-021's V2 gate)

**Status:** triaged · **Priority:** P2 · **Opened:** 2026-10-20 · **Reporter:** agent (gate logs)

## Observed vs expected
- **Observed:** `polls pending → awaiting_confirm → confirmed, signs in once …` fails with "expected 'pending' to be 'awaiting_confirm'" after 15 s, while the hook had in fact signed in.
- **Expected:** a deterministic test of the three states.

## Reproduction (the spec for this bug)
- **Failing test:** the existing test, under load. The race is readable from the code: the mock answers `pending`, then `awaiting_confirm`, then `confirmed` on consecutive polls 20 ms apart; `waitFor` checks every 50 ms, so the `awaiting_confirm` render can come and go between two checks. Then the hook mapped a `confirmed` payload to the `pending` phase (there was no `confirmed` phase in `WaView`), so the assertion could never become true.
- **Reproduced on:** 2026-10-20 (3 gate logs).

## Root cause
Test: state transitions driven by a timer the test does not control. Hook: no `confirmed` phase — the step rendered "Waiting for your message…" for the instant between the tokens arriving and the navigation.

## Decision-log check
BUG-002 / BUG-018's class (a test racing a timer). ADR-0038 unaffected.

## Fix
- The mock answers from a variable the test advances only after it has observed the previous phase; `WaView` gains `confirmed` and the step says "You're in — one moment…".
- **Regression guard:** the rewritten test; a new assertion that a `confirmed` payload renders the `confirmed` phase.

## Lesson
A polled state machine test must own the clock or the answers; it may not own neither.
