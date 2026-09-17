# FEAT-007 — Post-service rating

**Status:** specced (autonomous) · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-18

## Problem / Why

The BRIEF's primary success signal is half-unmeasurable today: "≥ 3 rounds hit their
threshold AND **delivered jobs average ≥ 4.0 / 5 resident rating**". Rounds now open,
fill, close, get a vendor and get marked delivered (FEAT-003 → FEAT-006), but no resident
can say whether the job was any good, so there is no number to hold a vendor to. That is
also the mitigation the BRIEF names for its biggest liability risk (R3: "the moment we
recommend a vendor, a bad job is our brand's fault").

There is a second, blocking gap: a resident **cannot see a delivered round at all**.
`GET /rounds` returns OPEN rounds only, so the round a resident would rate is invisible to
the app. Rating is unreachable without a "rounds I've joined" read.

## Decisions baked in (ADR-0017)

- **One rating per (round, resident)**, upsertable — a resident can correct a mis-tap.
- **Stars 1–5 integer, optional comment** (≤ 500 chars). No photos, no per-criterion scores.
- **Ratings hang off the ROUND**, not the vendor. A vendor's score is the aggregate of the
  rounds they delivered, so there is one write path and the vendor link is always the one
  that actually did the job.
- **The first rating flips DELIVERED → RATED** through the existing guarded transition —
  never a direct status write. `RATED` therefore means "at least one resident has rated",
  not "everyone has"; waiting for everyone would strand rounds forever.
- Rating is allowed only on a **DELIVERED or RATED** round, only for a **participant**, and
  only within the caller's own society.
- FEAT-006's ROUND_DELIVERED SMS regains its rating ask, which is now a promise the system
  actually keeps.

## User stories

1. As a resident, I can see the rounds I've joined and their current status, so I can find
   the job that was delivered.
2. As a resident, I can rate a delivered job 1–5 with an optional comment, so my experience
   counts.
3. As a resident, I can see and change the rating I already left.
4. As the super-admin, I can see each round's ratings, so I know how a job went.
5. As the super-admin, I can see a vendor's average rating and how many ratings it is based
   on, so a bad vendor is visible before I assign them again.
6. As the super-admin, I can see the platform-wide average on the dashboard, because that is
   the BRIEF's success metric.

## Acceptance criteria (testable — this IS the definition of done)

**Schema**
- [ ] Migration adds `Rating` (id, roundId FK cascade, residentId FK cascade, stars Int,
      comment String?, createdAt, updatedAt) with a UNIQUE `(roundId, residentId)` and an
      index for vendor aggregation. Additive only; applies cleanly to existing data.

**Resident API**
- [ ] `GET /rounds/mine` returns every round the caller has joined, any status, newest
      first, each with the caller's units and their own rating (or null). Tenant-scoped:
      only rounds in the caller's society. An unauthenticated call gets 401.
- [ ] `PUT /rounds/:id/rating` with `{stars, comment?}` creates or replaces the caller's
      rating and returns it. `stars` must be an integer 1–5 (else 400); `comment` is
      trimmed and capped at 500 chars (else 400).
- [ ] Rating a round the caller has not joined → 403 NOT_A_PARTICIPANT (not 404: the round
      is legitimately visible to their society).
- [ ] Rating a round in another society → 404.
- [ ] Rating a round that is not DELIVERED/RATED → 409 ROUND_NOT_DELIVERED, and nothing is
      written.
- [ ] The FIRST rating on a DELIVERED round moves it to RATED via `RoundsService`; a second
      rating, or an edit, leaves the status at RATED and does not re-transition.
- [ ] `DELETE /rounds/:id/rating` removes the caller's own rating (404 if absent). The round
      stays RATED — status does not roll backwards.

**Admin API**
- [ ] `GET /admin/rounds/:id` includes each participant's rating (stars, comment, ratedAt,
      or null) and the round's average + count.
- [ ] `GET /admin/vendors` includes `averageRating` (1 decimal, null when unrated) and
      `ratingCount`, aggregated over that vendor's rounds.
- [ ] `GET /admin/dashboard` includes `ratings: { average, count }` over all rated rounds —
      the BRIEF's success metric. Zero ratings yields `{ average: null, count: 0 }`.
- [ ] Every admin rating read is SUPER_ADMIN-only; a resident token gets 403.

**Notifications**
- [ ] The ROUND_DELIVERED message asks the resident to rate the job (FEAT-006 removed that
      line precisely because nothing delivered it; it is now true). No new notification type
      and no new queue.

**Verification**
- [ ] `bash scripts/verify.sh` exits 0, with integration tests covering each endpoint's
      happy path plus 400 / 403 / 404 / 409 and the first-rating transition.

## Out of scope (explicit, prevents gold-plating)

- Any resident-facing UI. FEAT-008 (PWA shell, in flight in a parallel session) owns
  `App.tsx`, the nav and the `/rounds` page; a rating screen lands after it, as its own
  work item, against the API this ships.
- Rating the platform, rating other residents, vendor replies, disputes or moderation.
- Photos, per-criterion scores, tags, or free-text search over comments.
- Automatic vendor deactivation or any rule that acts on a low score.
- A separate rating-request notification type (the delivered message carries the ask).

## Open questions

- Should a low rating alert the admin? → Deferred, not asked: no alerting exists anywhere
  yet, and the dashboard makes it visible. Revisit with ops.
