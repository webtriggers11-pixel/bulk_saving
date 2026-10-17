import { useRef } from 'react';
import { originOf, toggleScheme, useAppearance } from '../../lib/appearance';
import { cn } from '../../lib/utils';
import { Icon } from './icon';

/**
 * The night switch (FEAT-016, ADR-0028). Tapping it reveals the other scheme as a circle
 * growing from this button — Telegram's gesture — via View Transitions. Named by what it
 * WILL do, so a screen reader hears "Switch to dark mode", not the current state.
 *
 * The glyph is the scheme you would go TO, and it turns over as it changes (`animate-pop`
 * keyed by scheme), so the press is answered even where the reveal does not run.
 */
export function SchemeToggle({ className }: { className?: string }) {
  const { scheme } = useAppearance();
  const button = useRef<HTMLButtonElement>(null);
  const next = scheme === 'dark' ? 'light' : 'dark';
  return (
    <button
      ref={button}
      type="button"
      aria-label={`Switch to ${next} mode`}
      onClick={() => toggleScheme(button.current ? originOf(button.current) : undefined)}
      className={cn(
        'press flex h-icon w-icon shrink-0 items-center justify-center rounded-control border border-paper/70 paint-glass text-ink shadow-control t',
        'hover:text-brand-ink focus-visible:shadow-focus focus-visible:outline-none',
        className,
      )}
    >
      <span key={scheme} className="animate-pop flex">
        <Icon name={next === 'dark' ? 'moon' : 'sun'} size={20} strokeWidth={1.9} />
      </span>
    </button>
  );
}
