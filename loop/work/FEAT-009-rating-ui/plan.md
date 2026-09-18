# Plan FEAT-009 — Rating UI

**Derived from:** spec.md · **Approved by:** Vivek (standing autonomous authorization) on 2026-09-18

## Technical approach

`apps/web` only. **No backend change** — FEAT-007's API is fixed; if a screen wanted a
different shape, that would mean the spec is wrong, not that the backend should move.

1. **`features/rating/rating.api.ts`** — `rateRound` (PUT) and `removeRating` (DELETE)
   through the existing `apiRequest` envelope client. The caller's identity comes from the
   token, so neither takes a resident id.
2. **`features/rating/useRating.ts`** — two mutations. Both invalidate `['rounds']` ONLY:
   `myRoundsQueryKey` is `['rounds','mine']`, a prefix child, so My Requests refetches too
   (confirmed with the FEAT-008 session). Not optimistic, per ADR-0018.
3. **`features/rating/StarRating.tsx`** — five stars as a real `radiogroup` of radios with
   "1 star" … "5 stars" labels; visually hidden but focusable inputs so keyboard focus and
   arrow keys work natively. Read-only mode (no `onChange`) renders text + stars and NO
   form controls, and carries the `my-rating` test id FEAT-008 already asserts.
4. **`features/rating/RateRound.tsx`** — the card-embedded control: unrated → prompt +
   form; saved → what they said + Change / Remove; editing → pre-filled form + Cancel.
   Submit disabled while in flight; a failed write keeps the typed comment.
5. **`features/rating/formatRating.ts`** — `average (count)` or "No ratings yet". One place,
   used by both admin surfaces, so a null average can never render as `0`.
6. **Wiring:** `MyRequestsPage` renders `<RateRound>` when `isRateable(status)`;
   `AdminVendorsPage` shows `formatVendorRating(vendor)`; `AdminRoundDetailPage` gains a
   Rating fact and a per-participant Rating column.

## Data model / contracts

None. Every type already exists from FEAT-007 (`RatingDto`, `RateRoundBody`, `MyRoundDto`,
`RatingSummary`, `VendorDto.averageRating/ratingCount`, `AdminRoundParticipantDto.rating`,
`AdminRoundDetailDto.ratings`).

## New decisions required

- **ADR-0018** — inline on the My Requests card; radiogroup star input; no optimistic
  write. Confidence Medium-High, judgment call. Written and accepted before implementation.

## Risks

- **Cross-session file contention.** FEAT-008 landed at d4a7cbd, and its session confirmed
  `App.tsx`, `features/shell`, `features/profile`, `QueryState.tsx` and `useRounds.ts` are
  settled. This plan adds `features/rating/` and touches only `MyRequestsPage.tsx` and the
  two admin pages. No route is added, so `App.tsx` is not touched at all.
- **Breaking FEAT-008's test contract.** Its `MyRequestsPage` test asserts a `my-rating`
  element that my change replaces. Kept deliberately via a `testId` prop rather than
  rewriting another session's test.
- **A rating that appears saved but is not.** The reason there is no optimistic write; the
  failure path is explicitly tested.
- **Verification interference.** The backend suites share one Postgres/Redis with the other
  session's V2/V3 runs, so full `verify.sh` waits until its V3 lands; web-only commands
  (`pnpm --filter web …`) touch neither and are safe meanwhile.
