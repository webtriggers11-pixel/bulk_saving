import { isStandalone } from './useInstallPrompt';

/**
 * How this device installs the app (FEAT-042, ADR-0049).
 *
 * - `prompt`: Chromium handed us `beforeinstallprompt`, so one tap opens its own dialog.
 * - `ios-safari`: Share sheet → Add to Home Screen.
 * - `ios-other`: Chrome / Edge / Firefox on iOS: Share in the address bar → Add to Home
 *   Screen (iOS 16.4+), Safari as the fallback.
 * - `ios-inapp`: an app's built-in browser (Google app, Instagram, Facebook…) can't add to
 *   the home screen; the page has to be opened in Safari.
 * - `android-manual`: Android with no held prompt (Firefox, Samsung Internet, an in-app
 *   browser, or Chrome before its engagement check): the browser menu's Install item.
 * - `none`: already installed, or a desktop browser with nothing to offer.
 */
export type InstallPlatform = 'prompt' | 'ios-safari' | 'ios-other' | 'ios-inapp' | 'android-manual' | 'none';

interface PlatformInput {
  userAgent: string;
  maxTouchPoints: number;
  /** A `beforeinstallprompt` is held. */
  canPrompt: boolean;
  /** Running from the home screen (display-mode standalone, or iOS `navigator.standalone`). */
  standalone: boolean;
}

/** iPhone / iPad / iPod, including iPadOS, which reports a Mac UA but has touch. */
export function isIos(ua: string, maxTouchPoints: number): boolean {
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/** Apps whose built-in browser can't add to the home screen. GSA = the Google app (it says "Safari" too). */
const IOS_IN_APP = /GSA\/|FBAN|FBAV|FBIOS|Instagram|Line\/|Snapchat|LinkedInApp|Twitter/;
/** Real browsers on iOS other than Safari. */
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS/;

/** Safari on iPhone/iPad: the one browser where the steps are the Share sheet. */
export function isIosSafari(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> = navigator): boolean {
  const ua = nav.userAgent;
  return isIos(ua, nav.maxTouchPoints) && /Safari/.test(ua) && !IOS_OTHER_BROWSER.test(ua) && !IOS_IN_APP.test(ua);
}

/** Pure, so every branch is testable with a UA string. */
export function classifyInstallPlatform({ userAgent: ua, maxTouchPoints, canPrompt, standalone }: PlatformInput): InstallPlatform {
  if (standalone) return 'none';
  if (canPrompt) return 'prompt';
  if (isIos(ua, maxTouchPoints)) {
    if (IOS_IN_APP.test(ua)) return 'ios-inapp';
    if (IOS_OTHER_BROWSER.test(ua)) return 'ios-other';
    // Safari says "Safari"; a bare WKWebView (most in-app browsers) does not.
    return /Safari/.test(ua) ? 'ios-safari' : 'ios-inapp';
  }
  if (/Android/.test(ua)) return 'android-manual';
  return 'none';
}

/** True when launched from the home screen, on any platform. */
export function launchedFromHomeScreen(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isStandalone() || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** The live device's platform. */
export function installPlatform(canPrompt: boolean): InstallPlatform {
  if (typeof navigator === 'undefined') return 'none';
  return classifyInstallPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    canPrompt,
    standalone: launchedFromHomeScreen(),
  });
}
