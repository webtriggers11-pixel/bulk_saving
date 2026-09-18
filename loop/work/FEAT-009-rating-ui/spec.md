# FEAT-009 — Rating UI: resident rates from My Requests, admin sees the averages

**Status:** specced (autonomous) · **Priority:** P2 · **Owner:** Vivek · **Opened:** 2026-09-18

## Problem / Why

FEAT-007 shipped rating as an API and nothing else. The consequence, stated plainly: **no
resident can rate anything and no admin can see a score.** The BRIEF's primary success
signal ("delivered jobs average ≥ 4.0 / 5") is computed and returned by
`GET /admin/dashboard`, and then displayed nowhere. FEAT-007's own user stories 4–6 ("As
the super-admin, I can **see** a vendor's average rating") are true at the contract level
and false on screen.

It was split this way on purpose — `apps/web` belonged to FEAT-008 (PWA shell) in a
parallel session, and splitting one feature across two sessions' files would have produced
conflicts. FEAT-008 landed at d4a7cbd, so this closes the gap.

## Groundwork this builds on (do not rebuild)

- `features/requests/MyRequestsPage.tsx` (FEAT-008) already lists every joined round with
  its status and already renders `myRating` read-only. The rating control belongs on the
  DELIVERED/RATED card there.
- `components/QueryState.tsx` (`QueryErrorState`) distinguishes offline from server error
  and stale from empty — reuse it, do not hand-roll error text.
- `myRoundsQueryKey` is `['rounds', 'mine']`, a prefix child of `['rounds']`, so a rating
  mutation invalidates `['rounds']` and both lists refresh. No new query key.

## User stories

1. As a resident, I can give a delivered job 1–5 stars from My Requests, so my experience
   counts without hunting for a form.
2. As a resident, I can add a short comment, and skip it if I have nothing to say.
3. As a resident, I can see the rating I left and change it.
4. As a resident, I can withdraw my rating.
5. As a resident on a phone with a flaky connection, a failed submit tells me it failed and
   keeps what I typed.
6. As a super-admin, I can see each vendor's average rating and how many ratings it rests on.
7. As a super-admin, I can see a round's average and what each resident said.

## Acceptance criteria (testable — this IS the definition of done)

**Resident (`/my-requests`)**
- [ ] A DELIVERED or RATED round shows a rating control; OPEN / CLOSED_* / ASSIGNED /
      CANCELLED rounds show none.
- [ ] Stars are keyboard-operable and screen-reader-sane: a `radiogroup` with five radios
      labelled "1 star" … "5 stars", arrow keys move, the selected one carries
      `aria-checked`. Not five bare `<div>`s with click handlers.
- [ ] Submitting sends `PUT /rounds/:id/rating` with `{stars}` and, when non-empty,
      `{comment}`; the card then shows the saved rating.
- [ ] An already-rated round shows the stars and comment, with a control to change it and
      one to remove it. Removing calls `DELETE` and returns the card to the unrated state.
- [ ] A failed submit shows an error (via the shared error component's language, not a bare
      status code), keeps the typed comment, and leaves the control usable for a retry.
- [ ] While a submit is in flight the submit control is disabled, so a double tap cannot
      send two writes.
- [ ] Comment input is capped at 500 characters client-side, matching the API.

**Admin**
- [ ] `/admin/vendors` shows each vendor's average and count — "4.5 (8)" — and an explicit
      "No ratings yet" for `averageRating: null`, never "0".
- [ ] `/admin/rounds/:id` shows the round's average + count, and each participant's stars
      and comment (or "—" when they have not rated).

**Verification**
- [ ] `bash scripts/verify.sh` exits 0, including the new CHORE-004 build step.
- [ ] Vitest covers: the star control's semantics and keyboard behaviour; submit, edit and
      remove on a DELIVERED card; no control on a non-rateable status; a failed submit
      keeping the comment; and both admin surfaces including the null-average case.

## Out of scope

- Any backend change. FEAT-007's API is fixed and already tested; if this feature needs an
  endpoint change, that is a signal the spec is wrong, not licence to edit the backend.
- A dedicated `/rounds/:id/rate` route (rating is inline — ADR-0018).
- Photos, per-criterion scores, editing someone else's rating, vendor replies, moderation.
- Sorting or filtering the admin vendor list by rating.
- Push/SMS nudges to rate (the delivered SMS already asks).

## Open questions

- Should a resident be nudged in-app (badge on the tab) when a round is rateable? → Not
  asked; deliberately deferred. It touches FEAT-008's nav, which has just settled.
