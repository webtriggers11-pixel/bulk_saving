import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  /**
   * V2 P1-3: the original version of this test asserted that dispatching after
   * unmount "does not throw", on the premise that React warns on a state update
   * after unmount. React stopped doing that in 18, so the assertion could never
   * fail — deleting the cleanup entirely left all three tests green. Spy on the
   * removals instead: this one DOES fail without the effect's return.
   */
  it('removes both listeners on unmount, so no listener outlives the component', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<Probe />);

    unmount();

    const removed = remove.mock.calls.map(([type]) => type);
    expect(removed).toContain('online');
    expect(removed).toContain('offline');
    remove.mockRestore();
  });
});
