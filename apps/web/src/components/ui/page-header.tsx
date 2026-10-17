import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  /** One line under the title. Omitted on screens whose title is self-evident. */
  subtitle?: string;
  /** A back control, a primary action — placed opposite the title. */
  action?: ReactNode;
  /** Something that sits left of the title, e.g. the brand mark on Home. */
  lead?: ReactNode;
  /**
   * FEAT-016: when the large title scrolls out of view, a compact bar with the title (and
   * the action) slides in at the top — the native large-title pattern. Resident screens
   * opt in; the admin layout has its own sticky header and does not.
   */
  collapsible?: boolean;
  className?: string;
}

/**
 * The top of a screen (CHORE-008, ADR-0022). Five screens had written this out
 * separately; the fifth had already drifted a size.
 *
 * It places a title, an optional line and an optional action. It does not know
 * about routes — a back button is an `action` the screen passes in, because the
 * header has no business deciding where "back" goes.
 */
export function PageHeader({ title, subtitle, action, lead, collapsible = false, className }: PageHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (!collapsible || !heading.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(heading.current);
    return () => observer.disconnect();
  }, [collapsible]);

  return (
    <>
      <header className={cn('animate-rise flex items-start justify-between gap-3', className)}>
        <div className="flex min-w-0 items-center gap-2.5">
          {lead}
          <div className="min-w-0">
            <h1 ref={heading} className="text-display font-extrabold text-ink">
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-caption text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {collapsible && compact && (
        // Not a second heading: the h1 above is still the page's title (it is only
        // scrolled away), so the bar repeats it as plain text.
        <div
          data-testid="compact-bar"
          className="compact-bar fixed inset-x-0 top-0 z-30 border-b border-paper/60 bg-paper/75 pt-[env(safe-area-inset-top)] shadow-nav backdrop-blur-chrome backdrop-saturate-200"
        >
          <div className="mx-auto flex h-[52px] max-w-md items-center justify-center gap-3 px-[22px]">
            {/* Title only. Repeating `action` here put a second live control with the same
                name in the tab order (V2 P2-5); the real one is a short scroll away. */}
            <span aria-hidden="true" className="truncate text-body font-extrabold text-ink">
              {title}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
