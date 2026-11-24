# Plan FEAT-045 — Check the invite code with the server before the next step

**Derived from:** spec.md · **Approved by:** agent (autonomous, owner standing direction) on 2026-11-24

## Technical approach

- Backend: `InviteCheckService` (auth module) does the lookup through `SocietiesService.findByInviteCode`, which already treats inactive as unknown. A failed lookup increments `invite-check:fail:<ipBucket>` with the same INCR + first-hit-EXPIRE Lua pattern as the OTP resend counter. Once the counter reaches 20, the service answers RATE_LIMITED *before* the lookup, so a valid code cannot be found by brute force once the budget is spent. `AuthController` gets `POST /auth/invite/check`, which maps the outcomes to 200 / 400 / 429.
- Shared: `InviteCheckBody`, `InviteCheckResponse`.
- Web: `checkInvite()` in auth.api, a `useMutation` in OnboardingPage. Its `onSuccess` advances the step and the error renders as a `Notice tone="error"` under the field. The message map gets the new code.

## Data model / contracts

`POST /auth/invite/check` body `{ inviteCode: string }` → `{ valid: true }`; errors `400 INVALID_INVITE_CODE`, `400 VALIDATION_ERROR` (shape), `429 INVITE_CHECK_RATE_LIMITED`. No DB change.

## New decisions required

ADR-0052: a separate pre-check endpoint, budgeted on failures per IP (Med confidence, judgment call).

## Risks

- Enumeration: the 36^8 code space with 20 misses/hour/IP makes it infeasible; the OTP door already reveals validity (400 vs 200), so nothing new leaks.
- Integration tests share an IP: the rate-limit test clears its key before and after.
