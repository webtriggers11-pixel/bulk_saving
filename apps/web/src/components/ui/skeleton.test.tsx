import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton, SkeletonScreen } from './skeleton';

describe('Skeleton', () => {
  it('is hidden from assistive tech — the screen announces once, not per block', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('staggers the sweep so a block of placeholders does not strobe', () => {
    const { container } = render(
      <>
        <Skeleton />
        <Skeleton delay={1} />
        <Skeleton delay={3} />
      </>,
    );
    const classes = [...container.children].map((c) => c.className);
    expect(classes[0]).not.toMatch(/skeleton-d/);
    expect(classes[1]).toMatch(/skeleton-d1/);
    expect(classes[2]).toMatch(/skeleton-d3/);
  });
});

describe('SkeletonScreen', () => {
  it('keeps the loading sentence available to assistive tech while drawing shapes', () => {
    render(
      <SkeletonScreen label="Loading rounds…" testId="rounds-skeleton">
        <Skeleton className="h-10" />
      </SkeletonScreen>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading rounds…')).toBeInTheDocument();
    expect(screen.getByTestId('rounds-skeleton')).toBe(region);
  });
});
