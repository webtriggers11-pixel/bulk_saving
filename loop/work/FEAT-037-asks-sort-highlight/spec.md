# FEAT-037: "Residents are asking for": a sort toggle and highlighted recent requests

**Status:** in-progress · **Priority:** P2 · **Owner:** owner ("Residents are asking for sort proper sort this proper also recent one hilight") / agent · **Opened:** 2026-11-22 · **Builds on:** BUG-029

## Acceptance criteria
- [x] AC1 — The list has a sort control: **Newest first** (default; the server's order) and **Most asked** (ask count descending, then newest). Choosing one reorders the listed requests. The choice is kept in the URL (`?asks=most`), so a shared link opens the same order.
- [x] AC2 — Requests from the last 24 h are highlighted: an amber-tinted row with a ring and a **New** badge. The single newest request is labelled **Newest**.
- [x] AC3 — Each row says when the latest ask came in ("3 min ago") and how long the oldest has waited.
- [x] AC4 — Tests + gate; V2; V3.
