# ADR-0049: Ask to install on every open, with a root-level toast and per-platform steps

**Status:** Accepted · **Date:** 2026-11-24 · **Deciders:** Vivek ("whenever user will open the PWA application show the toaster … to install"), agent · **Work item:** FEAT-042 · **Amends:** ADR-0041 decision 4 (the Home install card)

## Decisions
1. **One `InstallToast`, mounted in `main.tsx` beside `<App />`**, so every route asks: sign-in, onboarding, the resident shell and admin. It appears 2 s after the app opens (the first screen paints first) and stays until acted on. It is pinned at the top, because the bottom is taken by the resident nav and the rounds invite toast. It yields the top slot to any other top toast (`yieldTop`), so the dev OTP code is never covered (V2 P1-1). It is mounted in `App.tsx` so the route tests prove every door has it.
2. **Per-platform behaviour from one pure classifier** (`classifyInstallPlatform`): a held `beforeinstallprompt` → one tap opens the browser's dialog. Otherwise Install opens a sheet of steps for iOS Safari, Chrome/Edge/Firefox on iOS, in-app browsers (open in Safari), or Android without a prompt (browser menu → Install app). Desktop without a prompt and anything already standalone → nothing. A prompt that arrives after the toast is up turns it into one-tap install.
3. **"Not now" lasts one visit** (`sessionStorage`), not forever (ADR-0041 used `localStorage`). The owner asked to be asked every time the app is opened. Storage failure means it may ask again; it never throws.
4. **The Home `InstallCard` is removed**; Profile's row stays. Chromium's own mini-infobar stays suppressed: the toast is our one ask.

## Confidence
**Med.** The classifier is unit-tested against real UA strings, but UA sniffing is heuristic. iOS apps that open links in SFSafariViewController (WhatsApp, Gmail, X) send Safari's exact UA, so they get Safari's steps. Those steps end with "Don't see Add to Home Screen? Open in Safari first" (V2 P2-1). Android WebViews (`; wv)`) get their own open-in-Chrome steps (V2 P2-2). The steps' wording follows Safari 18 / Chrome 130 menus, and browsers move their menus.

## Research depth
**Quick check:** `beforeinstallprompt` is Chromium-only and fires once, possibly seconds after load; `prompt()` needs a user gesture; iOS has no install API, and since iOS 16.4 Chrome/Edge/Firefox can Add to Home Screen from Share; WKWebView in-app browsers cannot.

## Consequences
Good: every open of the site in a browser asks, on every platform, with the right instructions. Bad: a resident who never installs sees the toast once per visit. That is the owner's explicit choice. If it reads as nagging, make the snooze last N days.

## Revisit trigger
Owner or resident feedback that it nags → a days-based snooze. A browser changes its menu wording → update `STEPS` in InstallToast.tsx.
