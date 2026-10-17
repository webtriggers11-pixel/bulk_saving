# CHORE-011 — the dev catalog is full of E2E leftovers

**Status:** done (closed 2026-10-17) · **Priority:** P3 · **Opened:** 2026-09-19 · **Found by:** CHORE-009's browser pass

The Services screen in the dev database lists eight "E2E Service 011682"-style rows at
₹999/unit, created by past runs of `scripts/e2e-smoke.mjs`, alongside the five real seeded
services. Harmless to the product, ugly in any demo, and it makes the catalog screen a poor
read on whether the design works with real content.

Fix: have the smoke harness clean up what it creates, or scope its fixtures to a society
that the seed's demo resident is not in. Then re-seed.
