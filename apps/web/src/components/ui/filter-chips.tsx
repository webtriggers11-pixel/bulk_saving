import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { cn } from '../../lib/utils';

export interface FilterChipOption {
  /** '' is the "all" option — the absence of a filter. */
  value: string;
  label: string;
}

interface FilterChipsProps {
  /** The group's name, e.g. "Category" — shown before the chips and used as their accessible name. */
  label: string;
  options: readonly FilterChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * A single-choice row of chips (FEAT-015). It is a radio group, not a row of toggle
 * buttons: exactly one is chosen, and the keyboard model is the radio one — Tab
 * enters the group on the chosen chip, arrow keys move AND choose, Home/End jump.
 * On a phone it scrolls sideways rather than wrapping into a wall of pills.
 *
 * The chosen chip pops (`.chip`, theme.css); every chip springs under the finger.
 */
export function FilterChips({ label, options, value, onChange, className }: FilterChipsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const labelId = useId();

  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  // On a phone the rail scrolls, and a choice made elsewhere (a shared link, a refresh)
  // can sit off-screen — the row then shows no chosen chip at all (FEAT-015 browser pass).
  // `nearest` scrolls the rail sideways only as far as needed and never jumps the page.
  useEffect(() => {
    refs.current[selected]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  function move(event: KeyboardEvent, from: number) {
    const last = options.length - 1;
    const to =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (from + 1) % options.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (from - 1 + options.length) % options.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (to === null) {
      return;
    }
    event.preventDefault();
    onChange(options[to].value);
    refs.current[to]?.focus();
  }

  // Visible, because two rows of chips that both start with "All" read as one muddle
  // (FEAT-015 browser pass) — the label says which row is which.
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3', className)}>
    <span id={labelId} className="term-label shrink-0 text-ink-soft sm:w-20">
      {label}
    </span>
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="chip-rail -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 py-1"
    >
      {options.map((option, index) => {
        const checked = index === selected;
        return (
          <button
            key={option.value || 'all'}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              'chip min-h-touch shrink-0 whitespace-nowrap rounded-full border px-4 text-meta font-bold',
              'focus-visible:shadow-focus focus-visible:outline-none',
              checked
                ? 'border-transparent bg-ink text-white shadow-glow'
                : 'border-shade/15 bg-white/60 text-ink-muted hover:bg-white hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
    </div>
  );
}
