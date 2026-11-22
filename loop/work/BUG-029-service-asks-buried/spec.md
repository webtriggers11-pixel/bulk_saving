# BUG-029: A resident's service request is invisible to the admin. "Residents are asking for" is buried below the fold, sorted oldest-first, with no highlight

**Status:** done · **Priority:** P1 · **Severity:** a core loop is broken (ask → admin opens a round) · **Owner:** owner (reported 2026-11-22: "I have created recently a Wigna Heights Society and I have asked for RO Water Purifier Service but in admin dashboard there should be a no option to create it … There should be a one notification or something … highlighted like a Wigna Heights have recently asked for this service") / agent · **Opened:** 2026-11-22 · **Introduced by:** FEAT-034 (dashboard redesign put the overview's newest-societies and newest-users lists above the FEAT-022 asks card)

## Reproduction (owner's dev DB, read-only check)
1. A resident of *avighna heights* taps **Ask** on *RO Water Purifier Service* (`ServiceAsk` row 2026-11-22 14:14, offering enabled, service active, no open round).
2. Open `/admin`. The first screen shows the quick actions, stat tiles and the newest societies and users. Nothing mentions the ask.
3. `GET /admin/dashboard` does return the ask, but the card sits far down the page, after the overview lists and the status tiles. Rows sort by ask count and then oldest first, so a brand-new single ask is LAST among single asks. There's no "new" marker and no count in the navigation.

## Expected
- An admin sees waiting requests the moment they open the console, with the newest ask called out: "*avighna heights* asked for *RO Water Purifier Service* · 3 min ago → **Open a round**".
- The navigation shows how many requests are waiting, from any admin page.
- "Open a round" lands on New round with society and service already chosen, and says who's asking, so the admin only sets the price tiers and deadline.

## Acceptance criteria
- [x] AC1 — `AdminServiceAsk` carries `latest` (the newest ask's time). The dashboard's asks list is the actionable pairs (unchanged rule) sorted newest-first by `latest`, and rows from the last 24 h carry a **New** badge.
- [x] AC2 — `/admin` opens with a "Residents are asking" alert at the top (above the stats) when there's at least one actionable ask. It names the newest society and service, how long ago, how many residents, and has an **Open a round** link with society and service prefilled. With several waiting asks it says "+N more" and links to the full list.
- [x] AC3 — `GET /admin/overview` returns `waitingAsks` (the count of actionable pairs). The sidebar's **New round** entry shows it as a badge on every admin page.
- [x] AC4 — New round, when opened from an ask (`?society&service`), shows "N residents of <society> asked for this" above the tiers.
- [x] AC5 — Regression tests first (failing at HEAD): backend `latest` and newest-first order; web alert, badge, New marker, prefilled context. Then the gate; V2; V3.

## Accepted limits (V2)
- The waiting-requests window is the 100 most recently asked pairs, filtered afterwards (P3-3). A burst of asks for a service that can't be acted on can push older actionable pairs out of the window. The count and the list share that source, so they always agree (P2-1 fixed).
- The New round "who asked" line only finds the 20 listed requests (P3-5).
