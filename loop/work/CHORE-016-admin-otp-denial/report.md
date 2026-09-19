# CHORE-016 — an admin's own sign-in can be denied with six unauthenticated requests

**Status:** triaged · **Priority:** P2 · **Opened:** 2026-09-19 · **Found by:** V2 round 2 of FEAT-012

## What

`POST /auth/admin/otp/request` is unauthenticated and its only input is a phone number.
Six requests against an administrator's number exhaust their 5-per-hour budget, and each
request `DEL`s and replaces any code already outstanding. For the next hour that
administrator cannot sign in.

The attacker needs the phone number and nothing else — and the phone number is the whole
credential the admin door asks for.

## Why it is not fixed here

It needs a policy decision, not a patch. The candidates each trade something:

- **Per-IP limits on top of per-phone.** Helps against a single source, not a botnet, and
  the global throttler (120/min/IP) already exists but is far too loose to matter here.
- **A separate, higher budget for numbers that are administrators.** Reintroduces
  ADR-0023's oracle: a budget that differs by role is a signal that differs by role.
- **Don't replace an outstanding code on resend.** Narrows the denial to "no NEW code"
  rather than "the code you were reading is now wrong", which is the more annoying half.

The second is the interesting one: the obvious mitigation is exactly the thing the
enumeration work removed, so whatever is chosen has to be uniform across callers.

## Related

Pre-existing on the resident door too, where an invite code is also required — a real but
meaningfully higher bar. See ADR-0023.
