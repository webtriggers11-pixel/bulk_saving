import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryErrorState } from './QueryState';

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

describe('QueryErrorState', () => {
  afterEach(() => {
    setOnline(true);
  });

  it('asks the resident to retry when the server failed but the connection is fine', () => {
    render(<QueryErrorState subject="rounds" hasData={false} onRetry={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-mode', 'error');
    expect(alert).toHaveTextContent("We couldn't load the rounds. Please try again.");
    expect(alert).not.toHaveTextContent(/offline/i);
  });

  it('blames the connection, not the server, while offline', () => {
    setOnline(false);
    render(<QueryErrorState subject="rounds" hasData={false} onRetry={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-mode', 'offline-empty');
    expect(alert).toHaveTextContent(/You're offline/i);
  });

  it('frames a failed REFRESH as staleness, so a populated list is not read as an error', () => {
    render(<QueryErrorState subject="rounds" hasData onRetry={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-mode', 'stale');
    expect(alert).toHaveTextContent(/Showing what we loaded earlier/i);
    // Amber, not red: the page still has usable data on it.
    expect(alert.className).toContain('amber');
  });

  it('warns that offline data may have changed when it is showing cached data', () => {
    setOnline(false);
    render(<QueryErrorState subject="rounds" hasData onRetry={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('data-mode', 'offline-stale');
    expect(alert).toHaveTextContent(/they may have changed/i);
  });

  it('retries on demand', () => {
    const onRetry = vi.fn();
    render(<QueryErrorState subject="rounds" hasData={false} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
