# CHORE-025 — Website: fill the empty space (story step cards, sticky side columns, tighter rhythm)

**Status:** in-progress · **Priority:** P2 · **Owner:** Vivek ("there is lot of empty spaces … make some animations or some cards or interaction in that") · **Opened:** 2026-10-20 · **Parent:** FEAT-028

## Problem / Why
At desktop width the scroll story's left column is mostly blank (52vh captions with nothing in them), the phone mocks in Trust / Phone and the left columns of Look / Calculator stop while their lists run on, and the Roadmap's "Now" column holds one card against two. It reads as unfinished.

## Acceptance criteria
- [ ] AC1 Each story step carries a mini card (round opened with tiers; your pledge; neighbours joining with a filling row; closed · met with the vendor booked and a rating) that animates when its step is current; captions are 38vh on desktop.
- [ ] AC2 Side columns (Trust, Phone, Look, Calculator outputs) are sticky at ≥900px so they travel with their lists.
- [ ] AC3 Roadmap "Now" has two cards (WhatsApp sign-in is done).
- [ ] AC4 Section padding 88px at desktop; tests cover the step cards; V1, V2, V3.
