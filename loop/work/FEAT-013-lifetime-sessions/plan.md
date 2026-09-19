# Plan FEAT-013 — Lifetime sessions

**Derived from:** spec.md · **Approved by:** standing autonomous authority

## Technical approach

One constant in `auth.service.ts` becomes a nullable, env-overridable getter, and the two
places that consume it learn to mean "no expiry" (ADR-0024):

- `signPair` — omit `expiresIn` from the refresh token's sign options when lifetime.
- `issueTokens` — `redis.set(key, jti)` with no `EX` when lifetime.
- `refresh` — the rotation Lua sets the new jti; the `EX` argument becomes conditional,
  so a rotated handle stays persistent instead of quietly acquiring a 30-day clock on
  first use. This is the subtle one: getting `signPair` right and leaving the Lua alone
  would produce a token that never expires guarded by a handle that does, i.e. a session
  that dies 30 days after its last refresh while claiming to be permanent.

The access token and its TTL are untouched, which is what keeps AC5 true.

## Data model / contracts

No contract change — `AuthTokens` is the same shape. `JWT_REFRESH_TTL_SECONDS` joins the
env surface; absent or `0` means lifetime, a positive number means seconds.

## New decisions required

- **ADR-0024** — sessions do not expire by default; revocation moves entirely to the Redis
  handle. Confidence Medium, judgment call, with a mandatory revisit trigger.

## Risks

- **The Lua TTL, described above.** Covered by AC2 and an explicit test that reads the
  key's TTL after a rotation, not just after issue.
- **Env validation.** `env.validation.ts` must accept the new optional var rather than
  reject boot.
- **Existing tests** assert the 30-day TTL; they encode the old policy and get rewritten
  to assert the new one, not deleted.
