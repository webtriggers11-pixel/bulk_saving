# FEAT-012 — Admin sign-in is its own page, and asks only for a phone number

**Status:** specced · **Priority:** P1 · **Owner:** Vivek (requested) / agent · **Opened:** 2026-09-19

## Problem / Why

A super-admin today signs in through the resident front door: invite code, then phone,
then OTP — and lands on the resident home, where a card offers a link to `/admin`. Two
things are wrong with that. The invite code is a *society* credential handed to residents;
an admin is not joining a society, they already administer one, so the first thing the
product asks them for is a code they have no reason to hold. And an admin who types the
wrong number gets no signal at all until they are sitting on a resident home screen
wondering where the dashboard went — which is exactly how this session's sign-in failed.

Admins get their own door: `/admin/login`, phone and OTP, straight into the dashboard.

## User stories

1. As a super-admin, I can sign in at `/admin/login` with my phone number alone, so that
   I never have to hold a resident's invite code.
2. As a super-admin, I land on the admin dashboard when I sign in, so that I do not pass
   through a resident screen I have no use for.
3. As a super-admin whose session has lapsed, visiting `/admin` takes me to the admin
   sign-in page, not the resident one.
4. As a resident who wanders onto `/admin/login`, my number does not sign me in there.

## Acceptance criteria (testable — this IS the definition of done)

- [ ] AC1 — `POST /auth/admin/otp/request { phone }` sends an OTP when that phone is a
      SUPER_ADMIN, and answers `{ requested: true }`.
- [ ] AC2 — the same endpoint answers `{ requested: true }` for a phone that is NOT an
      admin, and sends nothing. The response does not reveal who is an admin.
- [ ] AC3 — `POST /auth/admin/otp/verify { phone, code }` returns tokens + resident for a
      SUPER_ADMIN, with `societyId` derived server-side from that admin's own row —
      never from the request body (ADR-0003).
- [ ] AC4 — the admin verify path NEVER creates a resident. An unknown phone cannot
      bring an account into existence through the admin door.
- [ ] AC5 — a RESIDENT who somehow presents a valid code on the admin path is refused
      with 403 `NOT_AN_ADMIN` and receives no tokens.
- [ ] AC6 — the existing resident endpoints (`/auth/otp/request`, `/auth/otp/verify`) are
      unchanged in behaviour, invite code still required.
- [ ] AC7 — `/admin/login` renders a two-step (phone → code) form, on the design system,
      with no invite-code field anywhere on it.
- [ ] AC8 — a successful admin sign-in navigates to `/admin`.
- [ ] AC9 — an unauthenticated visit to any `/admin/*` route redirects to `/admin/login`;
      an authenticated RESIDENT visiting `/admin/*` still goes to `/`.
- [ ] AC10 — the OTP rate limits (1/30s, 5/hour) apply to the admin path too.

## Out of scope (explicit, prevents gold-plating)

- Any SMS provider work. The stub channel stays as-is.
- Removing the "Super-admin → Admin dashboard" card from the resident home. An admin who
  signs in the resident way is still an admin; that shortcut keeps working.
- Password auth, magic links, or a second factor.
- Separate admin branding/theme beyond what the design system already gives.

## Open questions

- Should a super-admin still be able to sign in through the resident door? → Yes. Nothing
  about that path is broken; this adds a door, it does not close one. (agent, stated
  assumption — the request said "give different page", not "remove the old way".)
