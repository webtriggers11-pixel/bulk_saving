import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toast } from './toast';

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces politely without stealing focus', () => {
    render(<Toast onDismiss={() => undefined}>Saved</Toast>);
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveTextContent('Saved');
  });

  it('renders the label above the message', () => {
    render(
      <Toast label="Dev only" onDismiss={() => undefined}>
        Your code is 123456
      </Toast>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Dev only');
  });

  it('dismisses on the close button', () => {
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>Saved</Toast>);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after the given duration', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast duration={5_000} onDismiss={onDismiss}>
        Saved
      </Toast>,
    );

    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('stays up indefinitely when duration is null (long enough to copy a code)', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <Toast duration={null} onDismiss={onDismiss}>
        Your code is 123456
      </Toast>,
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('renders nothing when there is no message', () => {
    const { container } = render(<Toast onDismiss={() => undefined}>{null}</Toast>);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
