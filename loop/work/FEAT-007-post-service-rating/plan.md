# Plan FEAT-007 — Post-service rating

**Derived from:** spec.md · **Approved by:** Vivek (standing autonomous authorization) on 2026-09-18

## Technical approach

Backend only, no new dependency. The rounds domain already owns everything this touches.

1. **Schema.** `Rating` in `apps/backend/prisma/schema.prisma`, additive. Unique
   `(roundId, residentId)`; index `(roundId)` for the per-round read and the aggregates.
   Generated with `prisma migrate diff` and applied with `prisma migrate deploy` — never
   `migrate dev`, which still wants a dev-DB reset (the stale FEAT-004 checksum row).
2. **`RatingsService`** (rounds module — ratings are a round concern, like the fan-out):
   - `upsertForRound(roundId, societyId, residentId, {stars, comment})` — in ONE
     transaction: lock nothing (no counter changes), verify the round exists in the
     society (404), verify participation (403), verify status ∈ {DELIVERED, RATED} (409),
     upsert the row, and, if the round was DELIVERED, call
     `RoundsService.markRated()` so the status moves through the guarded transition.
   - `removeForRound(...)` — delete own rating (404 if absent); status unchanged.
   - `listForRound(roundId)` / aggregate helpers for the admin reads.
3. **Resident endpoints** on the existing `RoundsController`:
   `GET /rounds/mine`, `PUT /rounds/:id/rating`, `DELETE /rounds/:id/rating`, with a
   `RateRoundDto` (`@IsInt() @Min(1) @Max(5)`, optional `@MaxLength(500)` comment).
   `GET /rounds/mine` is a new read on `RoundsService`: rounds the caller participates in,
   any status, newest first, shaped as today's `RoundDto` plus `myRating`.
4. **Admin surfacing** in `RoundsAdminService` / `VendorsService`: participant ratings and a
   per-round average on the detail; `averageRating` + `ratingCount` per vendor;
   `ratings: {average, count}` on the dashboard. All read-side `groupBy`/`aggregate`.
5. **Notification copy.** Restore the rating ask in the ROUND_DELIVERED template and flip
   the FEAT-006 test that forbids the phrase — it is no longer a promise we cannot keep.
6. **Transition ownership is unchanged**: `RoundsService.transition()` stays the only
   writer of `status`; `RatingsService` calls `markRated()` and never touches the column.

## Data model / contracts

```prisma
model Rating {
  id         String   @id @default(cuid())
  roundId    String
  round      Round    @relation(fields: [roundId], references: [id], onDelete: Cascade)
  residentId String
  resident   Resident @relation(fields: [residentId], references: [id], onDelete: Cascade)
  stars      Int      // 1..5, validated in the DTO
  comment    String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([roundId, residentId])
  @@index([roundId])
}
```

New/changed `@bulk/shared` types: `RatingDto`, `RateRoundBody`, `MyRoundDto`
(`RoundDto & { myRating: RatingDto | null }`), `AdminRoundParticipantDto.rating`,
`AdminRoundDetailDto.ratings`, `VendorDto.averageRating` / `.ratingCount`,
`AdminDashboardDto.ratings`.

New error codes: `NOT_A_PARTICIPANT` (403), `ROUND_NOT_DELIVERED` (409).

## New decisions required

- **ADR-0017** — ratings on the round, one per participant, first rating flips DELIVERED →
  RATED, vendor scores aggregated on read. Confidence Medium-High, judgment call. Written
  and accepted before implementation.

## Risks

- **`RATED` is a weaker claim than it reads** (one rating out of twelve flips it). Recorded
  in ADR-0017's consequences; every admin surface shows the count next to the average so
  the status is never read alone.
- **Cross-session collision.** A parallel session owns `apps/web` for FEAT-008 and its spec
  states FEAT-007's schema change would collide with it. This plan therefore ships **no web
  file at all**; `GET /rounds/mine` is deliberately included because FEAT-008's "My
  Requests" tab needs it and FEAT-008 cannot add a backend route.
- **Migration on the dev DB** with its known stale checksum row — `migrate diff` +
  `migrate deploy`, then a drift check. Needs the owner's approval to apply, as FEAT-006's
  did.
- **Aggregate correctness under the shared test DB.** Vendor and dashboard averages are
  global reads; every assertion must be scoped to fixtures the test created, or asserted as
  a delta, never as an absolute platform-wide number.
