# FEAT-026 — Dev mode: the OTP arrives as a toast at the top

**Status:** done · **Priority:** P2 · **Owner:** owner (requested: "in dev mode otp send in toast msg in top") / agent · **Opened:** 2026-10-20

## Problem / Why
Signing in on a dev machine means reading `dev:last-otp:<phone>` from Redis by hand. CHORE-007
(ADR-0020) removed the code from the auth response on purpose — the flag alone was a bypass in
the shipped path. The owner wants the convenience back, in dev only.

## Acceptance criteria
- [x] AC1 — `GET /dev/otp?phone=<any spelling>` returns `{ code }` from the stub channel's stash
      (`dev:last-otp:<canonical phone>`, 120s) or 404. The route's MODULE is registered only when
      `OTP_DEV_LOG=true` and `NODE_ENV` is explicitly `development`/`test` (default closed) — otherwise the route does not exist
      (404 like any unknown path). The auth request/verify responses are unchanged in every environment.
- [x] AC2 — The web, in a DEV build only (`import.meta.env.DEV`; the production bundle carries no
      call), asks that route after a successful "Send code" (retrying briefly — the admin door's
      code is queued) and shows a toast at the TOP: "DEV ONLY · Your code is 123456", with a
      "Use it" action that fills the code field. Both doors (resident onboarding, admin login).
- [x] AC3 — Toast gains `placement: 'bottom' | 'top'` (bottom stays the default); respects the
      safe area; one toast at a time as today.
- [x] AC4 — Tests: backend — module present → 200 with the stashed code, unknown phone → 404,
      module absent (OTP_DEV_LOG=false) → 404; web — DEV: toast with the code, "Use it" fills the
      field; the dev route 404s → no toast; non-DEV (`vi.stubEnv`) → no call at all; toast top
      placement. Gate; V2; V3.
- [x] AC5 — ADR-0037 amends ADR-0020 §A: the dev affordance is a dev-only route + dev-only bundle
      path, never the auth response.

## Out of scope
Any production path; the preview build on :5175 (a production bundle — it will not show the toast).
