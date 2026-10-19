# FEAT-021 — From a service to booking it in one tap

**Status:** done · **Priority:** P1 · **Owner:** Vivek (requested) / agent · **Opened:** 2026-10-19

## Problem / Why

Owner: "from /services it needs to redirect to that service to book, right?" The service
cards are dead ends: price and scope, nothing to tap. Booking here means joining that
service's open round (rounds are admin-opened, ADR-0010), so the catalog must say whether
a service can be booked right now and take the resident straight to it.

## Acceptance criteria

- [x] AC1 — a service with an open round shows it on its card (open · today's price · units
      joined · closes in …) and the whole card is a link to `/rounds?join=<roundId>`.
- [x] AC2 — a service with no open round says "No group buy open yet" and is not a link.
- [x] AC3 — `/rounds?join=<id>` scrolls that round into view, highlights it briefly, and opens
      its pledge sheet (Join, or Change if already pledged); the param is then removed from the
      URL so back/refresh does not reopen it.
- [x] AC4 — a `join` id that is not an open round shows "That group buy has closed or isn't
      open any more" above the list.
- [x] AC5 — frontend only (matches on service slug against the rounds list already fetched);
      highlight motion off under reduced motion; tests; browser pass.

## Out of scope

- "Ask for this service" when no round is open (needs an API) — follow-up.
