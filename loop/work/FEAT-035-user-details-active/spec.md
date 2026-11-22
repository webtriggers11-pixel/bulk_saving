# FEAT-035: User detail page; switch users and societies active/inactive

**Status:** in progress · **Priority:** P1 · **Owner:** owner (requested: "where I can see the user details and all … delete edit active in active all type of things") / agent · **Opened:** 2026-11-22

## Acceptance criteria
- [ ] AC1 — Migration: `Resident.active` and `Society.active`, both `Boolean @default(true)`. Additive: every existing row stays active.
- [ ] AC2 — An inactive resident can't sign in at either door (OTP verify and WhatsApp confirm refuse with ACCOUNT_DISABLED) or refresh. Deactivating revokes all their sessions. You can't deactivate yourself or the last active admin.
- [ ] AC3 — An inactive society's invite code admits nobody (INVALID_INVITE_CODE, the same answer as an unknown code). Residents already signed in keep their sessions (ADR-0045 §4, revised).
- [ ] AC4 — `GET /admin/residents/:id`: profile, society, role, active, dates, and every pledge (round id, service name, status, units, paid, round date). `PATCH /admin/residents/:id` accepts `active`; `PATCH /admin/societies/:id` accepts `active`.
- [ ] AC5 — Web: `/admin/users/:id` detail page (profile card, access, status switch, pledges list, edit/remove). Users list rows link to it and show an Inactive badge, with a status filter. The society page gets an Active switch, and the list shows Inactive.
- [ ] AC6 — Tests + gate; V2; V3.
