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

const VALIDATORS = { category: (v: string) => v === 'Vehicle' || v === 'Utilities' };

function Probe() {
  const { filters, setFilters, clear, activeCount, generation } = useUrlFilters(KEYS, VALIDATORS);
  const [text, setText] = useDebouncedSearch(filters.q, (q) => setFilters({ q }), generation);
  const location = useLocation();
  const navigationType = useNavigationType();
  return (
    <div>
      <input aria-label="search" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={() => setFilters({ category: 'Vehicle' })}>vehicle</button>
      <button onClick={clear}>clear</button>
      <output data-testid="url">{location.search}</output>
      <output data-testid="count">{activeCount}</output>
      <output data-testid="category">{filters.category ?? ''}</output>
      <output data-testid="nav">{navigationType}</output>
    </div>
  );
}

/** Like Probe, but the URL catches up 50ms after a commit — a slow navigation. */
function SlowProbe() {
  const { filters, setFilters } = useUrlFilters(KEYS);
  const [text, setText] = useDebouncedSearch(filters.q, (q) => {
    setTimeout(() => setFilters({ q }), 50);
  });
  const location = useLocation();
  return (
    <div>
      <input aria-label="search" value={text} onChange={(e) => setText(e.target.value)} />
      <output data-testid="url">{location.search}</output>
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
    // The race needs the URL to catch up AFTER more typing. With a synchronous commit
    // the URL updates before the next keystroke and the race never happens — which is
    // how the first version of this test passed with the guard deleted (V2 P2-1).
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={['/x']}>
        <SlowProbe />
      </MemoryRouter>,
    );
    const box = screen.getByLabelText('search');
    fireEvent.change(box, { target: { value: 'tan' } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS); // commit("tan") — URL not updated yet
    });
    fireEvent.change(box, { target: { value: 'tank cl' } });
    act(() => {
      vi.advanceTimersByTime(50); // now the URL says "tan"
    });
    expect(screen.getByTestId('url')).toHaveTextContent('?q=tan');
    expect(box).toHaveValue('tank cl');
  });

  it('"Clear filters" drops a half-typed search that was never committed (V2 P2-5)', () => {
    vi.useFakeTimers();
    renderAt('/x?category=Vehicle');
    const box = screen.getByLabelText('search');
    fireEvent.change(box, { target: { value: 'tan' } });
    fireEvent.click(screen.getByText('clear'));
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);
    });
    expect(box).toHaveValue('');
    expect(screen.getByTestId('url')).toHaveTextContent(/^$/);
  });

  it('ignores an invalid value — not sent, not counted (V2 P2-2)', () => {
    renderAt('/x?category=Foo&q=tank');
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('category')).toHaveTextContent('');
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
