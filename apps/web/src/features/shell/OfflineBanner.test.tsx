import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

describe('OfflineBanner', () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  it('renders nothing while online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('announces offline with a live region, and clears on reconnect', () => {
    render(<OfflineBanner />);

    setOnline(false);
    const banner = screen.getByTestId('offline-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(banner).toHaveTextContent(/offline/i);

    setOnline(true);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });
});
