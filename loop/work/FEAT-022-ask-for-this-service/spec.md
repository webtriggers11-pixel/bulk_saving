# FEAT-022 — "Ask for this service": demand that opens rounds

**Status:** done · **Priority:** P1 · **Owner:** Vivek ("yes do it") / agent · **Opened:** 2026-10-19

## Problem / Why

FEAT-021 made bookable services one tap from booking, but a service with no open round
was a dead end ("No group buy open yet"). Rounds are admin-opened (ADR-0010), so the useful
thing a resident can do there is SAY they want it — and the admin needs to see that demand
to know which rounds to open. When one opens, the people who asked should hear first.

## Acceptance criteria

- [x] AC1 — on a service with no open round, the card shows how many neighbours asked and an
      "Ask for this" button; asked → "Asked" (pressed) and tapping again withdraws.
- [x] AC2 — `POST/DELETE /catalog/:serviceId/ask`: idempotent; resident + society from the
      JWT; only a service the caller's society offers (else 404); refused (409
      ROUND_ALREADY_OPEN) while a round is open — join instead. `GET /catalog` carries
      `demand { askCount, askedByMe }` per service, counted within the caller's society.
- [x] AC3 — admin dashboard: "Residents are asking for" — per society × service, most asked
      first (top 20), how long they have waited, and "Open a round" which pre-fills the form.
- [x] AC4 — when a round opens for that society × service, every resident who asked gets a
      SERVICE_ASK_OPENED notification (SMS + push via the outbox, staged in the same
      transaction as the round) and the asks are cleared; the push opens that round's sheet.
- [x] AC5 — additive migration; tests both sides; V2; V3.
