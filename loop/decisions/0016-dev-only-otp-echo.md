# ADR-0016: Dev-only OTP echo in the request response, double-gated

**Status:** Accepted
**Date:** 2026-09-18 · **Deciders:** Vivek (explicit request), agent · **Work item:** CHORE-002

## Confidence

**Level:** High (that the gating is correct) / **Medium** (that it should exist at all)
**Basis:** The mechanism — an environment-gated dev affordance that is additionally
refused in production — is standard and the codebase already has the precedent
(`OTP_DEV_LOG` gates the stub channel's debug line). What is a judgment call is carrying
an auth bypass in the codebase at all; it is accepted because the owner asked for it
explicitly, the guard is two independent conditions, and the exposure is a single
optional field that is absent by default.

## Research depth

**Judgment call.** No external research. The decision rests on ADR-0007's stated rule and
on this repo's existing dev-flag precedent.

## Context and problem

The stub SMS adapter delivers nothing, so during local development there is no way to
obtain an OTP except reading Redis directly. The owner asked to show it in a toast.
ADR-0007 and CLAUDE.md both say the OTP is **never logged or returned**, so this cannot
be done without explicitly deciding to breach that rule under controlled conditions.

The risk is not theoretical: `POST /auth/otp/request` is unauthenticated. If the code
came back in the response in a deployed environment, anyone with an invite code and a
resident's phone number could obtain a token for that resident. Invite codes are shared
around a society, so that is a realistic attacker, not a hypothetical one.

## Options considered

1. **Double-gated optional field in the response** (chosen). Returned only when
   `OTP_DEV_LOG === 'true'` **and** `NODE_ENV !== 'production'`. Pro: the UI gets the
   code with no new endpoint, the flag already means "expose OTPs on this box", and the
   production check means a mis-set flag in prod still fails closed. Con: the bypass
   exists in the shipped code path and depends on `NODE_ENV` being correct in production.
2. **Log the OTP and have the developer read the server console.** Already possible via
   `OTP_DEV_LOG` today. Pro: nothing crosses the network, zero production risk. Con: does
   not answer the request — a toast is wanted precisely to avoid switching to the log.
3. **A separate dev-only endpoint** (`GET /dev/otp/:phone`) mounted only outside
   production. Pro: the production auth path keeps no dev branch at all — the cleanest
   separation. Con: a whole unauthenticated endpoint to guard instead of one field, and
   more to get wrong; deferred unless the field proves awkward.
4. **Seed a fixed OTP (e.g. `000000`) in development.** Pro: no leak of a real code, and
   nothing to display. Con: changes OTP generation — the one thing this work item must
   not touch — and would hide real bugs in generation and verification.

## Decision

Option 1. `OtpRequestResponse` gains an optional `devCode`, populated only when BOTH
conditions hold. The guard lives in one exported predicate so it is testable and there is
exactly one place to audit. The field is **omitted** (not null, not empty) whenever the
guard is false, so no client can come to rely on it, and the UI labels the toast DEV ONLY.
OTP generation, hashing, TTL, rate-limiting and verification are untouched.

## Consequences

Good: local sign-in works without reading Redis; one auditable predicate; production is
protected by a second, independent condition; trivially reversible.
Bad: an auth-bypass branch now exists in a production code path, guarded by environment
configuration — a class of thing that has burned many teams. It must not survive to a real
launch, and `OTP_DEV_LOG` now means two things at once (log the code, and return it).

## Revisit trigger

**Mandatory before the first real deployment:** delete this affordance, or replace it with
option 3 behind a build-time exclusion, as part of the ADR-0007 pre-launch auth hardening
already on record. Also revisit if a real SMS provider lands (the need disappears), or if
anyone asks for a second consumer of `devCode` — that is the signal it is becoming a
feature rather than a crutch.
