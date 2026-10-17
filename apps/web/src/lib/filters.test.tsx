import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS, toQueryString, useDebouncedSearch, useUrlFilters } from './filters';

describe('toQueryString', () => {
  it('drops unset and empty values and encodes the rest', () => {
    expect(toQueryString({})).toBe('');
    expect(toQueryString({ q: '', status: undefined })).toBe('');
    expect(toQueryString({ q: 'car wash', category: 'Bulk Staples' })).toBe('?q=car+wash&category=Bulk+Staples');
  });
});

const KEYS = ['q', 'category'] as const;

function Probe() {
  const { filters, setFilters, clear, activeCount } = useUrlFilters(KEYS);
  const [text, setText] = useDebouncedSearch(filters.q, (q) => setFilters({ q }));
  const location = useLocation();
  const navigationType = useNavigationType();
  return (
    <div>
      <input aria-label="search" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={() => setFilters({ category: 'Vehicle' })}>vehicle</button>
      <button onClick={clear}>clear</button>
      <output data-testid="url">{location.search}</output>
      <output data-testid="count">{activeCount}</output>
      <output data-testid="nav">{navigationType}</output>
    </div>
  );
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
    </MemoryRouter>,
  );
}

describe('useUrlFilters + useDebouncedSearch', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads its filters from the URL — a refresh or a shared link restores them', () => {
    renderAt('/x?q=tank&category=Utilities&other=keep');
    expect(screen.getByLabelText('search')).toHaveValue('tank');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('commits the search only once typing pauses, trimmed', () => {
    vi.useFakeTimers();
    renderAt('/x');
    const box = screen.getByLabelText('search');
    fireEvent.change(box, { target: { value: 'ta' } });
    fireEvent.change(box, { target: { value: ' tank ' } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(screen.getByTestId('url')).toHaveTextContent('');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('url')).toHaveTextContent('?q=tank');
  });

  it('does not overwrite letters typed after a commit when that commit comes back from the URL', () => {
    vi.useFakeTimers();
    renderAt('/x');
    const box = screen.getByLabelText('search');
    fireEvent.change(box, { target: { value: 'tan' } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    fireEvent.change(box, { target: { value: 'tank cl' } });
    // The URL now says "tan"; the box must keep what the admin is typing.
    expect(box).toHaveValue('tank cl');
  });

  it('adopts an external change — "Clear filters" empties the box too', () => {
    vi.useFakeTimers();
    renderAt('/x?q=tank&category=Utilities&other=keep');
    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByLabelText('search')).toHaveValue('');
    // Only this screen's keys are cleared.
    expect(screen.getByTestId('url')).toHaveTextContent('?other=keep');
  });

  it('replaces history rather than pushing an entry per change', () => {
    renderAt('/x');
    fireEvent.click(screen.getByText('vehicle'));
    expect(screen.getByTestId('url')).toHaveTextContent('?category=Vehicle');
    expect(screen.getByTestId('nav')).toHaveTextContent('REPLACE');
  });
});
