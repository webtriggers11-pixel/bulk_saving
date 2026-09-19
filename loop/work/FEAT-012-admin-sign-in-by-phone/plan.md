# Plan FEAT-012 — Admin sign-in by phone

**Derived from:** spec.md · **Approved by:** standing autonomous authority (owner: "don't ask me again")

## Technical approach

Two new endpoints beside the resident pair, sharing every piece of machinery below them
(ADR-0023). The resident path is not touched — its DTO still requires an invite code, and
its controller method is left alone.

The one thing the admin path must derive differently is `societyId`. The resident path
reads it from the invite code; the admin path reads it from the admin's own resident row,
found by phone. In both cases it comes from the server, never the body (ADR-0003).

## Data model / contracts

No schema change. `Resident` already carries `role` and `societyId`.

- `POST /auth/admin/otp/request` — body `{ phone }` → `{ requested: true }`, always.
- `POST /auth/admin/otp/verify` — body `{ phone, code }` → `AuthResult`.
  - 400 `OTP_INVALID` / `OTP_EXPIRED`, 429 `OTP_LOCKED` / `OTP_RATE_LIMITED` as today.
  - 403 `NOT_AN_ADMIN` when the row is not a SUPER_ADMIN.
- `ResidentsService.findAdminByPhone(phone)` — `findMany({ phone, role: SUPER_ADMIN })`,
  returns the row only when exactly one matches. Consulted ONLY after the OTP: it decides
  authorisation and dispatch, never what an unverified caller is told.
- The OTP itself is scoped by `ADMIN_OTP_SCOPE`, a server constant — not by society.
  Scoping it per-caller made the stored state an oracle (ADR-0023 decision 3). Both admin
  endpoints use that one scope for every number.

  *(This section originally specified a role-filtered lookup used BEFORE the code, which
  made `NOT_AN_ADMIN` unreachable and leaked registration status. Corrected here rather
  than left to disagree with the ADR — V2 P4.)*
- `packages/shared`: `AdminOtpRequestBody`, `AdminOtpVerifyBody`.
- `ErrorCode.NOT_AN_ADMIN`.

## Frontend

- `features/auth/AdminLoginPage.tsx` — two steps, `phone` → `otp`. Built from the same
  primitives as `OnboardingPage` (Input/Label/Button/Icon/AmbientGround), so it inherits
  the design system rather than restating it (ADR-0022). No invite-code state exists in
  this component at all — AC7 is a structural fact, not a style choice.
- `App.tsx`: public route `/admin/login`.
- `AdminRoute`: unauthenticated → `/admin/login` (was `/onboard`). Resident → `/` unchanged.
- `auth.api.ts`: `requestAdminOtp`, `verifyAdminOtp`.

## New decisions required

- **ADR-0023** — admin sign-in is a separate endpoint pair that derives the society from
  the admin's own row; the request step is deliberately non-enumerating. Confidence Medium,
  judgment call.

## Risks

- **Enumeration.** A uniform `{ requested: true }` means a resident who mistypes on the
  admin page waits for an SMS that never comes, then gets "Incorrect code". Accepted: the
  alternative is an endpoint that tells any caller which numbers are admins.
- **Two doors, one session shape.** A session minted at the admin door is an ordinary
  session; nothing downstream can tell which door it came through, and nothing should.
