import { type HTMLAttributes, type PointerEvent } from 'react';
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

/**
 * FEAT-019 (ADR-0031): the spotlight. An interactive card tells the stylesheet where the
 * mouse is (`--mx`/`--my`); the Vercel look paints a soft accent disc there. Written to the
 * element's style directly — a re-render per pointer move would be absurd. Touch is ignored.
 */
function trackPointer(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse') return;
  const box = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty('--mx', `${Math.round(event.clientX - box.left)}px`);
  event.currentTarget.style.setProperty('--my', `${Math.round(event.clientY - box.top)}px`);
}

export function Card({
  surface = 'glass',
  interactive = true,
  padding = 'default',
  className,
  onPointerMove,
  ...props
}: CardProps) {
  return (
    <div
      onPointerMove={
        interactive
          ? (event) => {
              trackPointer(event);
              onPointerMove?.(event);
            }
          : onPointerMove
      }
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

/**
 * Sizes a title can take, each carrying its own tracking.
 *
 * A PROP, not a className: `cn` is a plain join, so a `text-[25px]` passed alongside
 * the base `text-title` does not replace it — both land and Tailwind's output order
 * picks the winner, which for every size in this app was the base (BUG-007). Five
 * screens were asking for a size they never got.
 *
 * The tracking lives here for the same reason: arbitrary sizes bring none of their
 * own, unlike the named tokens, so the Home hero name was tracked and the Profile
 * hero name — same role, 1px larger — was not, depending on which caller remembered
 * (V2 P2-5). `sm` carries none because none was ever specified for it; inventing one
 * in a review round with no browser open would be guessing.
 */
const TITLE_SIZE = {
  sm: 'text-[18px]',
  md: 'text-title',
  lg: 'text-headline',
  xl: 'text-[24px] tracking-[-0.042em]',
  '2xl': 'text-[25px] tracking-[-0.045em]',
} as const;

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  size?: keyof typeof TITLE_SIZE;
}

export function CardTitle({ size = 'md', className, ...props }: CardTitleProps) {
  return <h2 className={cn(TITLE_SIZE[size], 'font-extrabold text-ink', className)} {...props} />;
}

/** The line under a title. `size` for the same reason CardTitle has one (BUG-007). */
export function CardDescription({
  size = 'caption',
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { size?: 'caption' | 'meta' }) {
  return (
    <p
      className={cn(size === 'meta' ? 'text-meta' : 'text-caption', 'text-ink-muted', className)}
      {...props}
    />
  );
}

export function CardEyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-eyebrow uppercase text-brand-ink', className)} {...props} />;
}
