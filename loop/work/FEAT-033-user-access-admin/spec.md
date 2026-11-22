# FEAT-033: Admin sees and manages every user: all societies, roles (access rights), edit, remove

**Status:** triaged · **Priority:** P1 · **Owner:** owner (requested: "as admin i want all access also users access right"; "show all users all society all cruds") / agent · **Opened:** 2026-11-22

## Acceptance criteria
- [ ] AC1 — `GET /admin/residents?q&societyId&role&cursor&limit` → `Page<AdminResidentDto>` across every society
  (id, name, phone, role, verifiedAt, createdAt, society {id,name}, pledgeCount). `q` matches name or phone.
- [ ] AC2 — `PATCH /admin/residents/:id {name?, role?}`: change a name or grant/revoke SUPER_ADMIN. Guards: you can't change
  your own role (409); the last SUPER_ADMIN can't be demoted (409).
- [ ] AC3 — `DELETE /admin/residents/:id` → 204. Refused for yourself and for the last SUPER_ADMIN (409). It revokes all of
  that resident's sessions. Their pledges and ratings go with them (onDelete Cascade), and the confirm sheet says so.
- [ ] AC4 — Web `/admin/users`: search, society and role filters, paginated list. Each row shows name/phone/society/role.
  A sheet edits the name and role (Resident/Admin), with remove behind a confirm. The society detail page links to its users.
- [ ] AC5 — Tests + Gate; V2; V3.
