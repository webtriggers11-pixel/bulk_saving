import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INSTALL_CARD_KEY, InstallCard, isIosSafari } from './InstallCard';
import { resetInstallPrompt } from './useInstallPrompt';

const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

const realUA = navigator.userAgent;
function setUA(ua: string, touchPoints = 0) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
}

function fireBeforeInstallPrompt(prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void> };
  event.prompt = prompt;
  act(() => {
    window.dispatchEvent(event);
  });
  return prompt;
}

/** `isStandalone()` reads `(display-mode: standalone)`; jsdom has no matchMedia by default. */
function setStandalone(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

describe('InstallCard (FEAT-029)', () => {
  const realMatchMedia = window.matchMedia;

  beforeEach(() => {
    resetInstallPrompt();
    window.localStorage.removeItem(INSTALL_CARD_KEY);
    setUA(ANDROID_CHROME);
    setStandalone(false);
  });

  afterEach(() => {
    resetInstallPrompt();
    setUA(realUA);
    window.matchMedia = realMatchMedia;
    vi.restoreAllMocks();
  });

  it('renders nothing until the browser says the app is installable', () => {
    render(<InstallCard />);
    expect(screen.queryByTestId('install-card')).toBeNull();
  });

  it('offers Install once Chromium hands over its prompt, and the button opens it', () => {
    render(<InstallCard />);
    const prompt = fireBeforeInstallPrompt();
    expect(screen.getByRole('region', { name: 'Install the app' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('"Not now" hides it and is remembered on this device', () => {
    const { unmount } = render(<InstallCard />);
    fireBeforeInstallPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('install-card')).toBeNull();
    expect(window.localStorage.getItem(INSTALL_CARD_KEY)).toBe('1');
    unmount();

    render(<InstallCard />);
    fireBeforeInstallPrompt();
    expect(screen.queryByTestId('install-card')).toBeNull();
  });

  it('never shows when already running from the home screen', () => {
    setStandalone(true);
    render(<InstallCard />);
    fireBeforeInstallPrompt();
    expect(screen.queryByTestId('install-card')).toBeNull();
  });

  it('on iOS Safari shows the Share-sheet steps with no Install button', () => {
    setUA(SAFARI_IPHONE);
    render(<InstallCard />);
    expect(screen.getByTestId('install-card-ios')).toHaveTextContent('Add to Home Screen');
    expect(screen.queryByRole('button', { name: 'Install' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByTestId('install-card')).toBeNull();
  });

  it('iOS launched from the home screen (navigator.standalone) shows nothing', () => {
    setUA(SAFARI_IPHONE);
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    try {
      render(<InstallCard />);
      expect(screen.queryByTestId('install-card')).toBeNull();
    } finally {
      Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true });
    }
  });

  it('a storage that throws never breaks it: the card shows, and dismissing still hides it', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<InstallCard />);
    fireBeforeInstallPrompt();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('install-card')).toBeNull();
  });

  it('isIosSafari: Safari on iPhone and iPadOS yes; Chrome on iOS and Android no', () => {
    const nav = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints }) as Navigator;
    expect(isIosSafari(nav(SAFARI_IPHONE))).toBe(true);
    expect(isIosSafari(nav(IPAD_DESKTOP_UA, 5))).toBe(true);
    expect(isIosSafari(nav(IPAD_DESKTOP_UA, 0))).toBe(false); // a real Mac
    expect(isIosSafari(nav(CHROME_IPHONE))).toBe(false);
    expect(isIosSafari(nav(SAFARI_IPHONE.replace('Mobile/15E148', 'Mobile/15E148 GSA/340.0')))).toBe(false); // Google app
    expect(isIosSafari(nav(ANDROID_CHROME))).toBe(false);
  });
});
