import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('is a radiogroup of five labelled radios, not five clickable divs', () => {
    render(<StarRating value={null} onChange={() => undefined} label="Rate AC" idPrefix="r1" />);

    const group = screen.getByRole('radiogroup', { name: 'Rate AC' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    // Singular for one, plural above — a screen reader should not say "1 stars".
    expect(screen.getByRole('radio', { name: '1 star' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeInTheDocument();
  });

  it('reports the selected value and marks exactly one radio checked', () => {
    render(<StarRating value={3} onChange={() => undefined} label="Rate AC" idPrefix="r2" />);

    expect(screen.getByRole('radio', { name: '3 stars' })).toBeChecked();
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
  });

  it('calls onChange with the chosen score', () => {
    const onChange = vi.fn();
    render(<StarRating value={null} onChange={onChange} label="Rate AC" idPrefix="r3" />);

    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('disables every radio while a write is in flight', () => {
    render(<StarRating value={2} onChange={() => undefined} disabled label="Rate AC" idPrefix="r4" />);

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  it('renders read-only with NO form controls when there is no onChange', () => {
    render(<StarRating value={4} label="Your rating" idPrefix="r5" />);

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByLabelText('4 out of 5')).toHaveTextContent('4 / 5');
  });

  it('read-only treats a missing value as zero rather than crashing', () => {
    render(<StarRating value={null} label="Your rating" idPrefix="r6" />);
    expect(screen.getByLabelText('0 out of 5')).toHaveTextContent('0 / 5');
  });
});
