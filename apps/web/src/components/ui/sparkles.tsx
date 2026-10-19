import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Sparkles (FEAT-019, ADR-0031): three small four-point stars that twinkle around
 * something worth celebrating — a saving, a best price. Decoration only: `aria-hidden`,
 * no layout (absolutely placed around an inline-block), and gone under reduced motion
 * (theme.css). Positions are fixed, not random, so a render is reproducible.
 */
const STARS = [
  { at: '-top-2 -left-2.5', size: 10, delay: '0ms' },
  { at: '-top-1.5 -right-3', size: 8, delay: '800ms' },
  { at: '-bottom-1 right-1/3', size: 7, delay: '1500ms' },
] as const;

export function Sparkles({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      {STARS.map((star) => (
        <svg
          key={star.at}
          aria-hidden="true"
          viewBox="0 0 24 24"
          width={star.size}
          height={star.size}
          className={cn('animate-twinkle pointer-events-none absolute fill-brand-2', star.at)}
          style={{ animationDelay: star.delay }}
        >
          <path d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z" />
        </svg>
      ))}
    </span>
  );
}
