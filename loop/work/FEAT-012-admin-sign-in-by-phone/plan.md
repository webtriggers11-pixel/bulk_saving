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
- `ResidentsService.findSuperAdminByPhone(phone)` — `findMany({ phone, role: SUPER_ADMIN })`,
  returns the row only when exactly one matches. Zero matches and ambiguous matches are
  both "no admin", so a phone that is an admin in two societies cannot be silently signed
  into whichever row Postgres happened to return first.
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
