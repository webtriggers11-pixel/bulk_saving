# FEAT-041: Declutter the admin dashboard into sidebar pages

**Status:** done · **Priority:** P2 · **Owner:** owner ("in Dashboard too much data is there can we move into as sidebar thing so it will clean and good look") / agent · **Opened:** 2026-11-23

## Acceptance criteria
- [x] AC1 — `/admin` keeps: the request alert, quick actions, the platform numbers, rounds-by-status tiles (each a link to `/admin/rounds?status=…`), and the newest societies and users.
- [x] AC2 — New sidebar pages under Group buys: **Requests** (`/admin/requests`: "Residents are asking for" with its sort; the waiting badge moves here), **Rounds** (`/admin/rounds`: the filterable rounds list with a New round button), **New round**, and **Reports** (`/admin/reports`: demand by society, collected, outstanding).
- [x] AC3 — Links follow: "+N more waiting" → Requests; the Open rounds tile → Rounds filtered OPEN; a round page's back link → Rounds.
- [x] AC4 — Tests + gate; browser pass (desktop and 390 px); V2; V3.
