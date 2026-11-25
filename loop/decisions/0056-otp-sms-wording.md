# ADR-0056: OTP SMS is worded as a friendly sign-in prompt with the code split 3-3

**Status:** Accepted
**Date:** 2026-11-25 · **Deciders:** owner (picked the wording) + agent · **Work item:** CHORE-028

## Confidence

**Level:** Low
**Basis:** one live test per wording on one SIM (Airtel) on one day: 5 of 5 classic OTP texts failed, 3 of 3 friendly variants were delivered. Carrier filters are undocumented and change without notice.

## Research depth

**Depth:** Quick check — live sends through TextBee to the owner's phone, statuses read back from the TextBee API.

## Context

ADR-0054 sends SMS from a personal SIM through TextBee. Indian carriers filter unregistered (non-DLT) A2P-looking traffic; Airtel dropped the classic "<code> is your … code. Do not share it" text every time.

## Options considered

1. **Keep the classic wording, use only the Vi SIM** — works today on Vi, but keeps the failing text on Airtel.
2. **Friendly prompt, code split `482-913`** — delivered on Airtel; owner's choice.
3. **Friendly prompt, code unsplit** (`Type 482913 in the app to continue.`) — also delivered; keeps phone autofill more likely.
4. **DLT-registered provider (MSG91 / 2Factor) or WhatsApp authentication** — the real fix; costs money and registration time.

## Decision

Option 2. `otpMessage(code)` = `Hi, welcome to BulkSaving. Please enter ${3}-${3} in the app to sign in.`; a code that is not 6 digits is shown unsplit. The server stays on the Vi SIM (slot 0) as well.

## Consequences

- The text no longer says "do not share" — a small loss of anti-phishing advice.
- The dash makes phone OTP autofill less likely; residents type the 6 digits (the input accepts digits only, so they must leave the dash out).
- It is a filter workaround, not a guarantee.

## Revisit trigger

Any OTP send failing again on either SIM, more than ~50 residents signing in per day, or the owner opening a DLT provider account → move to option 4.
