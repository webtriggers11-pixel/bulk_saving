import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus';

function Probe() {
  const online = useOnlineStatus();
  return <span data-testid="state">{online ? 'online' : 'offline'}</span>;
}

/** Drive `navigator.onLine` the way the browser would, then fire the event. */
function setNavigatorOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  it('starts from navigator.onLine', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    render(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('offline');
  });

  it('follows offline and online events without a reload', () => {
    render(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('online');

    setNavigatorOnline(false);
    expect(screen.getByTestId('state')).toHaveTextContent('offline');

    setNavigatorOnline(true);
    expect(screen.getByTestId('state')).toHaveTextContent('online');
  });

  it('removes its listeners on unmount', () => {
    const { unmount } = render(<Probe />);
    unmount();

    // No listener left to update a torn-down component: React would warn/throw
    // on a state update after unmount, so a clean dispatch proves cleanup.
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    expect(() => window.dispatchEvent(new Event('offline'))).not.toThrow();
  });
});
