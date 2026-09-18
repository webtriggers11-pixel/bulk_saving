# Plan FEAT-010 — Per-service unit labels

**Derived from:** spec.md · **Approved by:** Vivek (asked and approved) on 2026-09-18

## Technical approach

A labelling layer. Nothing about counting, pricing or billing changes.

1. **Schema.** `Service.unitLabel` / `unitLabelPlural` (NOT NULL, default + backfill
   `'unit'` / `'units'`) and nullable `unitDescription`. Generated with `prisma migrate diff`,
   applied with `migrate deploy` (never `migrate dev` — the dev DB's stale FEAT-004 checksum
   row still demands a reset).
2. **Contract.** Add the three fields to `RoundServiceSummary` in `@bulk/shared`. That type
   is already embedded in `RoundDto`, `MyRoundDto`, `AdminRoundSummaryDto` and
   `AdminRoundDetailDto`, so **every existing screen receives the label with no new request**
   — this is why the label goes on the service summary rather than being fetched separately.
   `AdminServiceDto` + create/update bodies gain them too.
3. **One formatter, shared.** `packages/shared` gets `formatUnits(count, service)` →
   `"1 room"` / `"2 rooms"`, and `unitLabelFor(service)` for "₹3,500 / room". Both pure.
   **Type-only imports do not apply here** — these are runtime values, and CHORE-004's lesson
   says a runtime import from `@bulk/shared` breaks the web production build (CommonJS named
   exports). So the formatter lives in `apps/web/src/lib/units.ts` for the web and
   `apps/backend/.../rounds/units.ts` for the backend, with a test in each pinning them to the
   same behaviour. Duplication is deliberate and pinned, rather than a build break.
4. **Backend renders:** the four SMS templates take the label through their existing
   `RoundForMessage` (which already carries `serviceName`), so `round-notifications.service.ts`
   passes it from the loaded service. No new query.
5. **Web renders:** `RoundsPage` (join label, pledge line, live counter, price),
   `MyRequestsPage` (pledge line, price), `AdminRoundDetailPage` (units/residents, tiers,
   participant rows), `AdminDashboardPage` (demand), `AdminNewRoundPage` (tier threshold
   labels), and the admin service form.
6. **Seed.** Real labels for the five seeded services: AC Servicing → AC unit, Pest Control →
   flat, Deep Cleaning → flat, Bathroom Wash → bathroom, **Painting → room** with a scope
   sentence. Seed is an idempotent upsert, so re-running updates existing rows.

## Data model / contracts

```prisma
model Service {
  // …existing
  unitLabel       String  @default("unit")   // singular, 1–24 chars
  unitLabelPlural String  @default("units")  // stored, never derived
  unitDescription String?                    // scope sentence, ≤140 chars
}
```

## New decisions required

- **ADR-0019** — label on the global Service; singular and plural both stored; no mechanic
  change. Confidence High; judgment call. Written and accepted before implementation.

## Risks

- **Touch surface is wide** (4 SMS templates, 6 web components, 2 admin forms), so the risk is
  a missed site rendering "units" next to a correctly-labelled one. Mitigation: grep-driven
  checklist in tasks.md, and a test per render site rather than per component.
- **A runtime import from `@bulk/shared` would break the web build** — CHORE-004 caught
  exactly this an hour ago. Mitigation: per-app formatters with pinned tests (§3), no runtime
  import from shared in web code.
- **Existing fixtures and tests** construct `RoundServiceSummary` literals; adding required
  fields breaks them at compile time (which is the point). Mitigation: fixtures get the
  defaults, and that surfaces every construction site.
- **Migration on the dev DB** with its known stale checksum row — `migrate diff` +
  `migrate deploy`, then a drift check.
- The backfill default means a service with no label is indistinguishable from one deliberately
  labelled "unit". Accepted; it is the degradation we want.
