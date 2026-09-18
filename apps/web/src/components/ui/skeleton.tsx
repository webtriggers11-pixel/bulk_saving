import { cn } from '../../lib/utils';

/**
 * A skeleton's corner has to match the thing it stands in for. As a className it did
 * not: the base `rounded-full` beat `rounded-chip` and `rounded-control`, so a 52px
 * input placeholder rendered as a stadium (BUG-007).
 */
const SKELETON_RADIUS = {
  full: 'rounded-full',
  chip: 'rounded-chip',
  control: 'rounded-control',
  inset: 'rounded-inset',
  tile: 'rounded-tile',
  card: 'rounded-card',
} as const;

interface SkeletonProps {
  className?: string;
  /** Stagger the sweep so a block of placeholders reads as one surface, not a strobe. */
  delay?: 0 | 1 | 2 | 3;
  /** Match the shape of what is coming — that is the whole point of a skeleton. */
  radius?: keyof typeof SKELETON_RADIUS;
}

const DELAYS = ['', 'skeleton-d1', 'skeleton-d2', 'skeleton-d3'] as const;

/**
 * One placeholder block (FEAT-011 AC4). A skeleton is only worth having if it is
 * the SHAPE of what is coming — so callers size these to the real element, and each
 * screen's skeleton mirrors its own layout rather than showing a generic spinner.
 *
 * Decorative by itself: the screen wrapper owns `aria-busy` and the announced label,
 * so a screen reader hears "Loading rounds…" once instead of forty placeholders.
 */
export function Skeleton({ className, delay = 0, radius = 'full' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('skeleton block', SKELETON_RADIUS[radius], DELAYS[delay], className)}
    />
  );
}

/**
 * The wrapper every screen skeleton sits in: it carries the busy state and the one
 * sentence that used to BE the loading state ("Loading rounds…"), now announced but
 * not drawn (AC4 — the existing tests' intent survives the redesign).
 */
export function SkeletonScreen({
  label,
  children,
  className,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-testid={testId}
      className={className}
    >
      <span className="sr-only-text">{label}</span>
      {children}
    </div>
  );
}
