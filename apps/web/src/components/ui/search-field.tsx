import { useRef } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from './icon';
import { Input } from './input';

interface SearchFieldProps {
  /** What is typed — the caller debounces before it reaches the server (ADR-0026). */
  value: string;
  onChange: (value: string) => void;
  /** The accessible name, e.g. "Search services". Also the placeholder unless one is given. */
  label: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

/**
 * A search box (FEAT-015): magnifier on the left, a clear button that pops in once
 * there is something to clear. Clearing returns focus to the field, so the next
 * thing typed lands where the eye already is. Escape clears too.
 *
 * `type=search` gives the right mobile keyboard. The browser's own clear button is
 * hidden in theme.css (`.search-input`) — Tailwind's preflight does NOT hide it, and the
 * FEAT-015 browser pass found two × buttons side by side.
 */
export function SearchField({ value, onChange, label, placeholder, maxLength, className }: SearchFieldProps) {
  const input = useRef<HTMLInputElement>(null);

  function clear() {
    onChange('');
    input.current?.focus();
  }

  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">
        <Icon name="search" size={18} strokeWidth={2} />
      </span>
      <Input
        ref={input}
        type="search"
        inset="icons"
        className="search-input"
        aria-label={label}
        placeholder={placeholder ?? label}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            clear();
          }
        }}
      />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={clear}
          // The hit area is the 44px touch floor; the visible disc inside it is smaller.
          // Centred with inset + auto margins, NOT a translate: `animate-pop` animates
          // `transform`, and on the button it replaced the -translate-y-1/2 and dropped
          // the button half its height (FEAT-015 browser pass). The pop is on the disc.
          className="group press absolute inset-y-0 right-0.5 my-auto flex h-touch w-touch items-center justify-center rounded-full focus-visible:outline-none"
        >
          <span className="animate-pop flex size-7 items-center justify-center rounded-full bg-shade/10 text-ink-muted t group-hover:bg-shade/20 group-hover:text-ink group-focus-visible:shadow-focus">
            <Icon name="close" size={14} strokeWidth={2.4} />
          </span>
        </button>
      )}
    </div>
  );
}
