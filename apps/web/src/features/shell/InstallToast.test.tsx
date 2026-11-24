import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DevOtpToast } from '../auth/DevOtpToast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INSTALL_SNOOZE_KEY, INSTALL_TOAST_DELAY_MS, InstallToast } from './InstallToast';
import { resetInstallPrompt } from './useInstallPrompt';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const realUA = navigator.userAgent;
const realMatchMedia = window.matchMedia;

function setUA(ua: string, touchPoints = 0) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
}

function setStandalone(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

function fireBeforeInstallPrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  act(() => {
    window.dispatchEvent(event);
  });
  return prompt;
}

function renderAndWait() {
  const view = render(<InstallToast />);
  act(() => {
    vi.advanceTimersByTime(INSTALL_TOAST_DELAY_MS);
  });
  return view;
}

describe('InstallToast (FEAT-042)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetInstallPrompt();
    window.sessionStorage.removeItem(INSTALL_SNOOZE_KEY);
    setUA(ANDROID_CHROME);
    setStandalone(false);
  });

  afterEach(() => {
    // Unmount first, so resetting the held prompt doesn't update a live component outside act (V2 P3-5).
    cleanup();
    vi.useRealTimers();
    resetInstallPrompt();
    setUA(realUA);
    window.matchMedia = realMatchMedia;
    vi.restoreAllMocks();
  });

  it('waits a moment after opening, then asks (AC2)', () => {
    render(<InstallToast />);
    expect(screen.queryByTestId('install-toast')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(INSTALL_TOAST_DELAY_MS);
    });
    expect(screen.getByTestId('install-toast')).toHaveTextContent('Install Bulk Saving');
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('Install opens the browser dialog when Chromium handed over its prompt, then stays hidden this visit (AC3)', async () => {
    const prompt = fireBeforeInstallPrompt();
    renderAndWait();
    expect(screen.getByTestId('install-toast')).toHaveAttribute('data-platform', 'prompt');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('install-toast')).toBeNull();
    expect(window.sessionStorage.getItem(INSTALL_SNOOZE_KEY)).toBe('1');
  });

  it('Android without a prompt: Install opens the browser-menu steps (AC3)', () => {
    renderAndWait();
    expect(screen.getByTestId('install-toast')).toHaveAttribute('data-platform', 'android-manual');
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(screen.getByRole('dialog', { name: 'Add Bulk Saving to your home screen' })).toBeInTheDocument();
    expect(screen.getByTestId('install-steps')).toHaveTextContent('Install app');
  });

  it('iPhone Safari: Install opens the Share-sheet steps (AC3)', () => {
    setUA(IPHONE_SAFARI, 5);
    renderAndWait();
    expect(screen.getByTestId('install-toast')).toHaveAttribute('data-platform', 'ios-safari');
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(screen.getByTestId('install-steps')).toHaveTextContent('Add to Home Screen');
  });

  it('switches to one-tap install when the prompt arrives after the toast is up (AC5)', async () => {
    renderAndWait();
    expect(screen.getByTestId('install-toast')).toHaveAttribute('data-platform', 'android-manual');
    const prompt = fireBeforeInstallPrompt();
    expect(screen.getByTestId('install-toast')).toHaveAttribute('data-platform', 'prompt');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('close snoozes for this visit only: sessionStorage, not localStorage (AC4)', () => {
    const { unmount } = renderAndWait();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('install-toast')).toBeNull();
    expect(window.sessionStorage.getItem(INSTALL_SNOOZE_KEY)).toBe('1');
    unmount();

    // Same visit: still quiet.
    renderAndWait();
    expect(screen.queryByTestId('install-toast')).toBeNull();
  });

  it('asks again on the next open: a new session starts without the snooze', () => {
    const { unmount } = renderAndWait();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    unmount();
    // A new visit = a fresh sessionStorage; localStorage is never written (ADR-0049 §3).
    expect(Object.keys(window.localStorage).filter((k) => k.includes('install'))).toEqual([]);
    window.sessionStorage.clear();
    renderAndWait();
    expect(screen.getByTestId('install-toast')).toBeInTheDocument();
  });

  it.each([
    ['iPhone Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1', 'ios-other', 'Open this page in Safari'],
    ['the Google app on iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/340.0 Mobile/15E148 Safari/604.1', 'ios-inapp', 'Open in Safari'],
    ['Instagram on Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 Instagram 350.0.0', 'android-inapp', 'Open in Chrome'],
  ])('%s gets its own steps', (_name, ua, platform, text) => {
    setUA(ua, ua.includes('iPhone') ? 5 : 0);
    renderAndWait();
    expect(screen.getByTestId('install-toast')).toHaveAttribute('data-platform', platform);
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(screen.getByTestId('install-steps')).toHaveTextContent(text);
  });

  it('iPhone Safari steps say what to do inside an app\'s Safari view (V2 P2-1)', () => {
    setUA(IPHONE_SAFARI, 5);
    renderAndWait();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(screen.getByTestId('install-steps')).toHaveTextContent('Open in Safari');
  });

  it('keeps the steps open when the prompt arrives mid-read; closing them returns to the toast (V2 P3-1, P3-2)', () => {
    renderAndWait();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    fireBeforeInstallPrompt();
    expect(screen.getByTestId('install-steps')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByTestId('install-steps')).toBeNull();
    expect(screen.getByTestId('install-toast')).toBeInTheDocument();
    expect(window.sessionStorage.getItem(INSTALL_SNOOZE_KEY)).toBeNull();
  });

  it('steps aside while the dev OTP code is showing, and comes back after (V2 P1-1)', () => {
    const { rerender } = render(
      <>
        <InstallToast />
        <DevOtpToast code={null} onUse={() => {}} onDismiss={() => {}} />
      </>,
    );
    act(() => {
      vi.advanceTimersByTime(INSTALL_TOAST_DELAY_MS);
    });
    expect(screen.getByTestId('install-toast')).toBeInTheDocument();
    rerender(
      <>
        <InstallToast />
        <DevOtpToast code="1111" onUse={() => {}} onDismiss={() => {}} />
      </>,
    );
    expect(screen.getByTestId('dev-otp-code')).toBeVisible();
    expect(screen.queryByTestId('install-toast')).toBeNull();
    rerender(
      <>
        <InstallToast />
        <DevOtpToast code={null} onUse={() => {}} onDismiss={() => {}} />
      </>,
    );
    expect(screen.getByTestId('install-toast')).toBeInTheDocument();
  });

  it('never throws when storage is blocked (AC4)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderAndWait();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('install-toast')).toBeNull();
  });

  it('never shows once installed: standalone, navigator.standalone, or appinstalled (AC4)', () => {
    setStandalone(true);
    const first = renderAndWait();
    expect(screen.queryByTestId('install-toast')).toBeNull();
    first.unmount();

    setStandalone(false);
    setUA(IPHONE_SAFARI, 5);
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    const second = renderAndWait();
    expect(screen.queryByTestId('install-toast')).toBeNull();
    second.unmount();
    Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true });

    renderAndWait();
    expect(screen.getByTestId('install-toast')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByTestId('install-toast')).toBeNull();
  });

  it('stays out of the way on a desktop browser with nothing to install', () => {
    setUA(DESKTOP_CHROME);
    renderAndWait();
    expect(screen.queryByTestId('install-toast')).toBeNull();
  });
});
