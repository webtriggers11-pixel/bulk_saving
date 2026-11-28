# BUG-037 — WhatsApp link preview shows code

**Status:** in-progress — V2 approved; V3 blocked by BUG-014 · **Priority:** P1 · **Opened:** 2026-11-28 · **Reporter:** owner

## Observed vs expected

- **Observed:** owner: "on share whatsapp in meta showing code". Sharing the invite link
  (`/onboard?code=…`, FEAT-032's WhatsApp share) shows the inline theme `<script>` source as the
  link preview's description.
- **Expected:** the preview says "Bulk Saving" with a one-line description of the app and the app icon.
- **Where:** `apps/web/index.html` — every route of the PWA serves it (SPA fallback).

## Reproduction (the spec for this bug)

- **Failing test:** `apps/web/src/pwa/share-preview.test.ts` — index.html carries a description and
  Open Graph tags ahead of any `<script>`; og:image exists; the build makes og:image/og:url absolute
  when `VITE_PUBLIC_ORIGIN` is set.
- **Reproduced on:** 2026-11-28

## Root cause

`index.html` has no `<meta name="description">` or `og:*` tags. Link-preview scrapers (WhatsApp/Meta)
then fall back to the first text in the document — the FEAT-016 pre-paint `<script>` in `<head>`.

## Decision-log check

No ADR covers share previews. ADR-0041 (PWA assets) supplies the icon reused as og:image.

## Fix

- description + og:title/description/type/site_name/image + twitter:card in `<head>`, before the script.
- `sharePreviewPlugin` (Vite `transformIndexHtml`): with `VITE_PUBLIC_ORIGIN` set at build, og:image
  becomes absolute and og:url is added (WhatsApp may ignore a relative image). Unset → relative, harmless.
- **Commits:** d257b83, 2621b0b (V2 P1: build plumbing) (V2 P1: build plumbing). V2 APPROVED.
- **Regression guard:** `apps/web/src/pwa/share-preview.test.ts`.
- **Deploy note:** set `VITE_PUBLIC_ORIGIN=https://<domain>` in the server's web build for the image.

## Lesson

A PWA shell still needs crawler-facing meta: scrapers do not run JS.
