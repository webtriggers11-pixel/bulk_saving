import { describe, expect, it } from 'vitest';
import { classifyInstallPlatform, isIosSafari } from './install-platform';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  iphoneEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/130.0 Mobile/15E148 Safari/605.1.15',
  iphoneGoogleApp:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/340.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0',
  iphoneWebView:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  ipadAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};

function classify(userAgent: string, opts: { touch?: number; canPrompt?: boolean; standalone?: boolean } = {}) {
  return classifyInstallPlatform({
    userAgent,
    maxTouchPoints: opts.touch ?? 0,
    canPrompt: opts.canPrompt ?? false,
    standalone: opts.standalone ?? false,
  });
}

describe('classifyInstallPlatform (FEAT-042 AC1)', () => {
  it('is none once installed, whatever else is true', () => {
    expect(classify(UA.androidChrome, { canPrompt: true, standalone: true })).toBe('none');
    expect(classify(UA.iphoneSafari, { touch: 5, standalone: true })).toBe('none');
  });

  it('is prompt whenever Chromium has handed over its prompt (Android or desktop)', () => {
    expect(classify(UA.androidChrome, { canPrompt: true })).toBe('prompt');
    expect(classify(UA.androidSamsung, { canPrompt: true })).toBe('prompt');
    expect(classify(UA.desktopChrome, { canPrompt: true })).toBe('prompt');
  });

  it('sorts iOS browsers: Safari, other real browsers, in-app browsers', () => {
    expect(classify(UA.iphoneSafari, { touch: 5 })).toBe('ios-safari');
    expect(classify(UA.ipadAsMac, { touch: 5 })).toBe('ios-safari');
    expect(classify(UA.iphoneChrome, { touch: 5 })).toBe('ios-other');
    expect(classify(UA.iphoneEdge, { touch: 5 })).toBe('ios-other');
    expect(classify(UA.iphoneGoogleApp, { touch: 5 })).toBe('ios-inapp');
    expect(classify(UA.iphoneInstagram, { touch: 5 })).toBe('ios-inapp');
    expect(classify(UA.iphoneWebView, { touch: 5 })).toBe('ios-inapp');
  });

  it('gives Android without a prompt the menu steps', () => {
    expect(classify(UA.androidChrome)).toBe('android-manual');
    expect(classify(UA.androidFirefox)).toBe('android-manual');
    expect(classify(UA.androidSamsung)).toBe('android-manual');
  });

  it('offers nothing on a desktop browser with no prompt (a Mac without touch is not an iPad)', () => {
    expect(classify(UA.desktopChrome)).toBe('none');
    expect(classify(UA.ipadAsMac, { touch: 0 })).toBe('none');
  });
});

describe('isIosSafari', () => {
  it('is true only for Safari itself', () => {
    expect(isIosSafari({ userAgent: UA.iphoneSafari, maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafari({ userAgent: UA.ipadAsMac, maxTouchPoints: 5 })).toBe(true);
    expect(isIosSafari({ userAgent: UA.iphoneChrome, maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: UA.iphoneGoogleApp, maxTouchPoints: 5 })).toBe(false);
    expect(isIosSafari({ userAgent: UA.androidChrome, maxTouchPoints: 5 })).toBe(false);
  });
});
