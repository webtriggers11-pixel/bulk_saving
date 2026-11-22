# ADR-0043: Admins create societies; invite codes are server-generated, rotatable, and travel as a deep link + QR

**Status:** Accepted · **Date:** 2026-11-22 · **Deciders:** owner (request), agent · **Work item:** FEAT-032 · **Builds on:** ADR-0003, ADR-0007, ADR-0036

## Confidence
**Level:** High for the API shape (it mirrors vendors/services). Med for the poster/print layout, which is a product call
the owner will look at.

## Research depth
**Quick check.** The `qrcode` package (already a web dependency, 1.5.4) renders SVG/data URLs in the browser. The Web Share API
and `wa.me/?text=` are standard.

## Decisions
1. **The server generates codes.** It uses 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no O/0/I/1/L, so a code read aloud
   or off a poster isn't misread) and `crypto.randomInt`, retrying on the unique-constraint clash. 31^8 ≈ 8.5×10^11 combinations. Combined with
   ADR-0027's OTP budgets, guessing a code is impractical. Admins can't type a code: chosen codes are guessable.
2. **Rotation** replaces the code in place. The old code fails at once (`INVALID_INVITE_CODE`), and residents who already joined stay joined.
   Use it when a poster leaks.
3. **Delete is allowed only while empty** (no residents, no rounds). A Society cascades to residents, rounds, offerings and pledges, and
   one click must never erase a society's history.
4. **The deep link is `<web origin>/onboard?code=XXXX`.** The QR code encodes the link, not the bare code, so a phone camera opens the app with
   the code filled in. The resident still taps Continue.
5. **QR codes are rendered in the browser** with the existing `qrcode` dependency: no new dependency and no server image endpoint.
6. **The poster** is a print-only section toggled by `@media print`. "Print poster" calls `window.print()`, and the browser's "Save as PDF"
   covers the PDF case without a PDF library.
7. **The invitation message** is plain text built in one pure function: Copy, Share (Web Share API), and WhatsApp (`wa.me/?text=`). Nothing
   is sent by the platform, so it costs nothing (bulk SMS is out of scope: ask first).

## Revisit trigger
Society-level admins (BRIEF non-goal #3); or a request for printed branding beyond the app's tokens.
