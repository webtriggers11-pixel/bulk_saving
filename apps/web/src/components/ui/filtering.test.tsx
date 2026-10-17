import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterChips } from './filter-chips';
import { SavedTick } from './saved-tick';
import { SearchField } from './search-field';
import { Switch } from './switch';

/** FEAT-015 filtering primitives: the behaviour a screen relies on, not the styling. */

function ControlledSearch({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <SearchField value={value} onChange={setValue} label="Search services" />;
}

describe('SearchField', () => {
  it('is a search box named by its label, with no clear button until there is text', () => {
    render(<ControlledSearch />);
    const box = screen.getByRole('searchbox', { name: 'Search services' });
    expect(box).toHaveAttribute('placeholder', 'Search services');
    expect(screen.queryByRole('button', { name: 'Clear search services' })).not.toBeInTheDocument();
    fireEvent.change(box, { target: { value: 'tank' } });
    expect(screen.getByRole('button', { name: 'Clear search services' })).toBeInTheDocument();
  });

  it('clears and puts focus back in the box, so the next keystroke lands there', () => {
    render(<ControlledSearch initial="tank" />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search services' }));
    const box = screen.getByRole('searchbox');
    expect(box).toHaveValue('');
    expect(box).toHaveFocus();
  });

  it('clears on Escape', () => {
    render(<ControlledSearch initial="tank" />);
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});

const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Utilities', label: 'Utilities' },
  { value: 'Vehicle', label: 'Vehicle' },
];

function ControlledChips({ onChange = vi.fn() }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <FilterChips
      label="Category"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('FilterChips', () => {
  it('is a radio group with exactly one chosen chip, and only that one in the tab order', () => {
    render(<ControlledChips />);
    expect(screen.getByRole('radiogroup', { name: 'Category' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it('chooses on click', () => {
    const onChange = vi.fn();
    render(<ControlledChips onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Vehicle' }));
    expect(onChange).toHaveBeenCalledWith('Vehicle');
    expect(screen.getByRole('radio', { name: 'Vehicle' })).toHaveAttribute('aria-checked', 'true');
  });

  it('arrow keys move AND choose, wrapping; Home and End jump; focus follows', () => {
    render(<ControlledChips />);
    const all = screen.getByRole('radio', { name: 'All' });
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Utilities' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Utilities' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Utilities' }), { key: 'End' });
    expect(screen.getByRole('radio', { name: 'Vehicle' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Vehicle' }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'All' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'Vehicle' })).toHaveAttribute('aria-checked', 'true');
  });

  it('scrolls only the chip rail to the chosen chip — never the page (V2 P1-3)', () => {
    const pageScroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = pageScroll;
    const rect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      // The rail is 0–200; "Vehicle", the chosen chip, sits at 260–340, off its end.
      if (this.getAttribute('role') === 'radiogroup') return { left: 0, right: 200 } as DOMRect;
      if (this.textContent === 'Vehicle') return { left: 260, right: 340 } as DOMRect;
      return { left: 0, right: 50 } as DOMRect;
    };
    try {
      render(<FilterChips label="Category" options={OPTIONS} value="Vehicle" onChange={() => {}} />);
      expect(screen.getByRole('radiogroup').scrollLeft).toBe(152);
      expect(pageScroll).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
      HTMLElement.prototype.getBoundingClientRect = rect;
    }
  });

  it('falls back to the first chip when the value matches no option', () => {
    render(<FilterChips label="Category" options={OPTIONS} value="Gone" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Switch', () => {
  it('is a switch that reports its state and asks for the other one', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Water Tank Cleaning active" text="Inactive" />);
    const control = screen.getByRole('switch', { name: 'Water Tank Cleaning active' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('while busy: ignores taps but keeps focus — disabling it dropped focus (V2 P2-3)', () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Tank active" text="Active" busy />);
    const control = screen.getByRole('switch', { name: 'Tank active' });
    control.focus();
    fireEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
    expect(control).toHaveFocus();
    expect(control).toBeEnabled();
    expect(control).toHaveAttribute('aria-busy', 'true');
  });

  it('is named by what it switches, not by its state text', () => {
    render(<Switch checked onChange={() => {}} label="Tank active" text="Active" />);
    expect(screen.getByRole('switch')).toHaveAccessibleName('Tank active');
  });

  it('does nothing when disabled', () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="x" disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SavedTick', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing until a save happens, plays once, then leaves', () => {
    vi.useFakeTimers();
    const { rerender } = render(<SavedTick trigger={null} />);
    // No live region at all until there is something to say (V2 P2-4).
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<SavedTick trigger={1000} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');

    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('replays for a second save rather than staying put', () => {
    vi.useFakeTimers();
    const { rerender } = render(<SavedTick trigger={1000} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(<SavedTick trigger={2000} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // The first save's timer must not cut the second save's tick short.
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });
});
