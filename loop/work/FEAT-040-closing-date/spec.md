# FEAT-040: Show the closing date next to the countdown

**Status:** in-progress · **Priority:** P2 · **Owner:** owner ("in user card, we are showing like 3 days or 15 days or 1 day today. Also with that, show the date also with highlighted color") / agent · **Opened:** 2026-11-23

## Acceptance criteria
- [x] AC1 — `formatClosingDate(iso, now)`: "Today, 6:30 pm", "Tomorrow, 6:30 pm", or "Wed 26 Nov, 6:30 pm" (with the year added when it isn't the current year), in the viewer's time zone.
- [x] AC2 — The resident round card shows a highlighted date chip (brand tone, calendar icon) next to the countdown pill. A screen reader hears "Closes Wed 26 Nov, 6:30 pm".
- [x] AC3 — Home's group-buys lead, the Services page and My Requests add the date after their countdown ("Closes in 3 days · Wed 26 Nov").
- [ ] AC4 — Tests + gate; V2; V3.
