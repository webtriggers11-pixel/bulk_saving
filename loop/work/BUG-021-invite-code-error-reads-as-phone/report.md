# BUG-021 — A malformed invite code reads as a phone-number error, and the WhatsApp step dead-ends on it

**Status:** triaged · **Priority:** P2 · **Opened:** 2026-10-20 · **Reporter:** owner (screenshot: "Confirm it's you on WhatsApp … That doesn't look like a phone number. Use your 10-digit mobile number, or +country code and number." with only "Use an SMS code instead" below)

## Observed vs expected

- **Observed:** the invite step accepts any non-empty code (e.g. `BLUE00`); "Continue with WhatsApp" then POSTs it, the DTO answers 400 `BAD_REQUEST` "inviteCode must be 8 uppercase alphanumeric characters.", and `authErrorMessage` maps every `BAD_REQUEST`/`VALIDATION_ERROR` to the PHONE hint (BUG-019 wired it that way when the only validated field was the phone). The WhatsApp step shows that notice with no retry and no way back except SMS — which would fail the same way.
- **Expected:** the invite step does not let a code that cannot be right through (8 letters/digits, like the phone field's plausibility gate); if the server still refuses a code, the message talks about the invite code; a failed start on the WhatsApp step offers "Try again".
- **Where:** owner's dev server, 2026-10-20 13:28; reproduced with `curl -d '{"inviteCode":"BLUE00"}' /auth/wa/start` → `BAD_REQUEST`.

## Reproduction (the spec for this bug)

- **Failing tests (written first):** `apps/web/src/features/auth/error-messages.test.ts` (a BAD_REQUEST whose server message names inviteCode → invite wording), `OnboardingPage.test.tsx` ("a short invite code keeps Continue off and says what a code looks like"), `WhatsAppSignIn.test.tsx` (a start error offers Try again).
- **Reproduced on:** 2026-10-20

## Root cause

Two gaps: the invite step validated presence, not shape (the SMS path hid it behind a second request where the phone was also checked); and the BUG-019 error mapping assumed every validation failure on the auth doors was the phone.

## Decision-log check

ADR-0036 (canonical phone) introduced the plausibility gate + hint pattern for the phone field; this applies the same pattern to the invite code. ADR-0038 unaffected.

## Fix

- **Commit:** <filled below>
- **Regression guard:** the three tests above.

## Lesson

A generic error code mapped to one field's wording is a trap the moment a second field is validated. Map on the server's message, or gate on the client so the server never has to say it.
