import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShowMore } from './show-more';

describe('ShowMore (FEAT-025)', () => {
  it('renders nothing when there is no next page', () => {
    render(<ShowMore hasMore={false} loaded={20} total={20} onMore={vi.fn()} noun={['round', 'rounds']} />);
    expect(screen.queryByTestId('show-more')).not.toBeInTheDocument();
  });

  it('says how many are left, and asks for the next page on tap', () => {
    const onMore = vi.fn();
    render(<ShowMore hasMore loaded={20} total={27} onMore={onMore} noun={['round', 'rounds']} />);
    const button = screen.getByTestId('show-more');
    expect(button).toHaveTextContent('Show 7 more rounds');
    fireEvent.click(button);
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it('one left is singular; more than a page says so; no total is just "Show more"', () => {
    const { rerender } = render(<ShowMore hasMore loaded={20} total={21} onMore={vi.fn()} noun={['request', 'requests']} />);
    expect(screen.getByTestId('show-more')).toHaveTextContent('Show 1 more request');
    rerender(<ShowMore hasMore loaded={20} total={120} onMore={vi.fn()} noun={['request', 'requests']} />);
    expect(screen.getByTestId('show-more')).toHaveTextContent('Show 50 more of 100 requests');
    rerender(<ShowMore hasMore loaded={20} onMore={vi.fn()} noun={['request', 'requests']} />);
    expect(screen.getByTestId('show-more')).toHaveTextContent('Show more');
  });

  it('waits while a page is loading', () => {
    render(<ShowMore hasMore busy loaded={20} total={30} onMore={vi.fn()} noun={['round', 'rounds']} />);
    expect(screen.getByTestId('show-more')).toBeDisabled();
    expect(screen.getByTestId('show-more')).toHaveTextContent('Loading…');
  });
});
