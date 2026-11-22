# FEAT-034: A proper admin console: a sidebar shell and a dashboard that leads with every operation

**Status:** triaged · **Priority:** P1 · **Owner:** owner (requested: "create it wise dashboard right now you have given a top bar, I want sidebar and the dashboard proper admin dashboard with all the operations") / agent · **Opened:** 2026-11-22

## Acceptance criteria
- [ ] AC1 — Desktop (≥ lg): a fixed left sidebar (brand, grouped nav: Overview · Onboarding [Societies, Users] · Group buys [Rounds dashboard, New round] · Catalog [Services, Vendors]; footer: theme toggle, Back to app). The content area sits beside it.
- [ ] AC2 — Phone/tablet (< lg): a slim top bar with a menu button that opens the same nav as a left drawer (focus trapped, Escape and backdrop close it, closes on navigation). No horizontal-scrolling nav rail.
- [ ] AC3 — The active page is marked (`aria-current`) and stays marked on child pages (`/admin/societies/:id`, `/admin/users/:id`).
- [ ] AC4 — The dashboard leads with platform numbers (societies, users, admins, open rounds; each links to its screen) and quick actions (Onboard a society, New round, Add vendor, Manage users), then recent societies and newest users, then the existing demand summary and rounds panel.
- [ ] AC5 — `GET /admin/overview` (SUPER_ADMIN) returns those counts and the 5 newest societies and users in one call.
- [ ] AC6 — Tests (layout: sidebar/drawer/active state; dashboard; overview API) + gate; V2; V3. The BUG-007 and design-system scans stay green.
