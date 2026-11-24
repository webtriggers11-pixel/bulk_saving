# FEAT-042: Ask to install the app every time it opens (toast, every route, Android + iOS)

**Status:** in-progress · **Priority:** P1 · **Owner:** owner / agent · **Opened:** 2026-11-24

**Owner request (2026-11-24):** "whenever user will open the PWA application show the toaster … to install the PWA application in their phone. right now there should be no auto pop up to user … we have to make this like a mobile application type thing and also it supports on iOS and Android properly … once the user open this our application it should show something like that can install that application for better experience."

## The problem now (FEAT-029 / ADR-0041)
- The only install prompt is a card on the resident Home page. A visitor sees nothing on sign-in, onboarding or /admin, so a new resident is never asked before they sign in.
- Its "Not now" is remembered **forever** on that device, so after one dismissal nobody is asked again.
- It appears only when Chromium has fired `beforeinstallprompt` or the browser is iOS Safari. Android browsers that don't fire it (Firefox, Samsung Internet before its heuristics pass, in-app browsers), Chrome before its engagement check, and Chrome/Edge on iOS get nothing.
- Chromium's own mini-infobar is suppressed (`preventDefault`), so from the user's side there is no install pop-up anywhere.

## Acceptance criteria
- [ ] AC1. `installPlatform()` sorts the device into one of: `prompt` (a held `beforeinstallprompt`), `ios-safari`, `ios-other` (Chrome/Edge/Firefox on iOS: Share → Add to Home Screen since iOS 16.4), `ios-inapp` (Google app, Instagram, Facebook… → open in Safari), `android-inapp` (Android WebViews → open in Chrome; V2), `android-manual` (Android, no held prompt: browser menu → Install app / Add to Home screen), or `none` (already standalone or `navigator.standalone`, or a desktop browser with no prompt). Unit-tested with real UA strings, iPadOS-as-Mac included.
- [ ] AC2. An `InstallToast` mounted at the app root (every route: sign-in, onboarding, resident shell, admin) appears about 2 s after the app opens when the platform isn't `none`. Title "Install Bulk Saving", one line on why ("Opens from your home screen like an app: full screen, faster, with notifications"), an **Install** button and a close button. It stays until acted on.
- [ ] AC3. **Install** on `prompt` opens the browser's own install dialog. On any other platform it opens a sheet with that platform's numbered steps (iOS Safari: Share (under ⋯ on newer iPhones) → Add to Home Screen → Add; iOS other: Share in the address bar → Add to Home Screen, or open in Safari; in-app: open this page in Safari; Android: browser menu ⋮ → Install app / Add to Home screen, or open in Chrome).
- [ ] AC4. Close / "Not now" hides it for this visit only (`sessionStorage`), so the next time the app is opened it asks again. A storage failure means it may show again; it never throws. It never shows once installed: standalone display mode, `navigator.standalone`, or after `appinstalled`.
- [ ] AC5. If Chromium hands over its prompt after the toast is already up (it can arrive a few seconds after load), the toast switches to the one-tap native install.
- [ ] AC6. The Home `InstallCard` is removed (the toast replaces it; two asks on one screen). Profile keeps its install row unchanged.
- [ ] AC7. Tests + gate; V2; V3. Nothing regresses: update prompt, offline banner, the dev OTP toast, push.

## Out of scope
- Changing the manifest, icons or iOS launch images (done in FEAT-029).
- A true OS-level automatic install dialog. Browsers allow `prompt()` only from a user tap, and iOS has no install API at all, so the toast is the most automatic thing the web platform allows.
