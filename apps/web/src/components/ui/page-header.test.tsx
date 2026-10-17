import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageHeader } from './page-header';

/** FEAT-016: the native large title that hands over to a compact bar on scroll. */
describe('PageHeader collapsing title', () => {
  let fire: (visible: boolean) => void = () => {};
  const observe = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          fire = (visible) => callback([{ isIntersecting: visible }]);
        }
        observe = observe;
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    observe.mockClear();
  });

  it('shows the compact bar only once the large title has scrolled away', () => {
    render(<PageHeader title="My Requests" collapsible action={<button>Act</button>} />);
    expect(screen.queryByTestId('compact-bar')).not.toBeInTheDocument();

    act(() => fire(false));
    const bar = screen.getByTestId('compact-bar');
    expect(bar).toHaveTextContent('My Requests');

    act(() => fire(true));
    expect(screen.queryByTestId('compact-bar')).not.toBeInTheDocument();
  });

  it('keeps ONE page heading — the bar repeats the title as plain, hidden text', () => {
    render(<PageHeader title="Profile" collapsible />);
    act(() => fire(false));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('does not watch the page at all unless asked (the admin header has its own)', () => {
    render(<PageHeader title="Services" />);
    expect(observe).not.toHaveBeenCalled();
  });
});
