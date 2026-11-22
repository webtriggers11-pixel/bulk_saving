# FEAT-032: Admin onboards a society: create it, get an invite code, a printable QR poster and a ready-to-send invitation

**Status:** in progress · **Priority:** P1 · **Owner:** owner (requested: "how to onboard society creating it then generate invite code and QR code print format also msg invitation … as admin i want all access") / agent · **Opened:** 2026-11-22

## Problem / Why
Societies exist only through the seed script. The admin can't create one, can't see or rotate its invite code,
and has nothing to give residents except the bare code. BRIEF.md lists `Societies` in the super-admin navigation.

## Acceptance criteria
- [ ] AC1 — API (SUPER_ADMIN only; a resident gets 403):
  `GET /admin/societies` (unchanged shape plus `residentCount`, `roundCount`, `createdAt`);
  `GET /admin/societies/:id`; `POST /admin/societies {name, city}` → 201 with a server-generated invite code;
  `PATCH /admin/societies/:id {name?, city?}`; `POST /admin/societies/:id/invite-code` → a fresh code (the old one
  stops working at once); `DELETE /admin/societies/:id` → 204 only when it has no residents and no rounds, else 409 CONFLICT.
- [ ] AC2 — Invite codes: 8 characters from an unambiguous alphabet (A–Z and 2–9, without O/I/L/0/1), from a CSPRNG,
  retried on the unique-constraint clash. They still match the existing `^[A-Z0-9]{8}$`.
- [ ] AC3 — Web `/admin/societies`: a list (name, city, code, resident count) with "New society", and a sheet to create or edit.
  The nav gains "Societies".
- [ ] AC4 — Web `/admin/societies/:id`: the code (Copy), the join link `<origin>/onboard?code=XXXX`, a QR code of that link,
  and "Print poster" (a print-only A4 layout: society name, big QR, the code, three steps). Also "Rotate code"
  (confirm sheet), edit, and delete (confirm; disabled with the reason while residents exist).
- [ ] AC5 — Invitation message: the full text is shown, with Copy, Share (Web Share API when the browser has it),
  and "Send on WhatsApp" (`https://wa.me/?text=…`). The message includes the society name, the link and the code.
- [ ] AC6 — `/onboard?code=XXXX` pre-fills the invite code (uppercased; an implausible one is ignored). The resident still taps Continue.
- [ ] AC7 — Tests: backend unit and integration (role guard, create/rotate/delete rules, code alphabet); web (list,
  create, detail QR/link/message, print button, onboarding pre-fill). Gate; V2; V3.

## Out of scope
Society-level admins (BRIEF non-goal #3); bulk SMS invitations (costs money: ask first); custom poster branding.
