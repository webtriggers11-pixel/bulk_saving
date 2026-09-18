import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Surface = 'glass' | 'solid' | 'tint' | 'accent';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Which ranked surface this card sits on (FEAT-011): the bento rhythm comes from mixing them. */
  surface?: Surface;
  /** Lift + light the gradient hairline on hover. Off for cards that are not a target. */
  interactive?: boolean;
  /**
   * How much room the card gives its content. A PROP, not a className: `cn` is a
   * plain join, so a `p-4` passed alongside the base `p-6` does not replace it —
   * both land and Tailwind's output order silently picks the winner (V2 P1-1).
   * `none` hands padding back to the caller, for the screens that size their own.
   */
  padding?: 'none' | 'tight' | 'snug' | 'default' | 'roomy';
}

const PADDING = {
  none: '',
  tight: 'p-4',
  snug: 'p-5',
  default: 'p-6',
  roomy: 'p-7',
} as const;

const SURFACES: Record<Surface, string> = {
  glass: 'surface-glass',
  solid: 'surface-solid',
  tint: 'surface-tint',
  accent: 'surface-accent',
};

export function Card({
  surface = 'glass',
  interactive = true,
  padding = 'default',
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card t',
        PADDING[padding],
        SURFACES[surface],
        interactive && 'card-hover card-glow',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 space-y-2', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-title font-extrabold text-ink', className)} {...props} />;
}

/** The eyebrow above a title — uppercase, tracked, brand-inked. */
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-caption text-ink-muted', className)} {...props} />;
}

export function CardEyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-eyebrow uppercase text-brand-ink', className)} {...props} />;
}
