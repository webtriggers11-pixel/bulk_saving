# FEAT-012 / CHORE-014 — browser pass (T7)

Driven against the real API on :3000 and the dev server on :5199, Chrome.

## What was exercised

| Step | Result |
|---|---|
| `/admin` while signed out | redirected to `/admin/login` (AC9) — previously `/onboard` |
| `/admin/login` renders | phone step only; no invite-code field anywhere (AC7) |
| Send code, admin number | `{requested:true}`; OTP appeared in Redis with a 117s TTL, i.e. minted by the click |
| Verify | landed on `/admin` with the dashboard loaded (AC8) |
| Token shape, read from localStorage | refresh token **has no `exp`**; access token has one, 15 min (FEAT-013 AC1/AC6) |
| `refresh:<id>` handle in Redis | `TTL -1` — no expiry (FEAT-013 AC2) |
| Resident door, full pass | invite → phone → code → signed in at `/` — unchanged by the Input/Notice refactor |
| Field legibility | code field carries the brand edge + ring; the optional name field now has a visible hairline where it previously had none |

## Found and fixed during the pass

- **The API on :3000 was a stale process** started before this work, so `/auth/admin/otp/request`
  answered 404 and the page showed "Something went wrong." Not a defect in the change — but it
  is what the screen looks like when the endpoint is missing, and the `Notice` rendered it
  correctly. Restarted the API; the same click then worked.

## Left behind deliberately

- Nothing. The throwaway resident (`+919800000777`) created for the resident-door pass was
  deleted, along with its three Redis keys — CHORE-011 exists because previous passes did not
  do this.
