# CHORE-019 — the demo seed mirrors scheduler constants by hand; the base seed has no guard

**Status:** done (closed 2026-10-17) · **Priority:** P3 · **Opened:** 2026-10-17 · **Found by:** CHORE-018 V2 round 2

1. `prisma/seed-demo.ts` copies the close/reminder queue names, job names, the `reminder-`
   id, attempts, backoff and the 24h lead from `src/modules/rounds/round-*.scheduler.ts`
   (it compiles outside `src/`). Nothing ties them together: a renamed reminder id would
   make every re-seed leave duplicate reminders. Fix: a shared constants module both
   import, or a backend test that imports both and asserts equality.
2. `seed:demo` runs the base `seed.js` first, which has no local-DB guard, so against a
   remote DB it upserts societies/admin/services before the demo step refuses. Upsert-only
   and pre-existing; move the guard to the script level or into `seed.ts`.
