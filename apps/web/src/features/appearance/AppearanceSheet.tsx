import { useRef, type KeyboardEvent } from 'react';
import { FilterChips } from '../../components/ui/filter-chips';
import { Icon } from '../../components/ui/icon';
import { Sheet } from '../../components/ui/sheet';
import {
  PALETTES,
  originOf,
  setPalette,
  setSchemePreference,
  useAppearance,
  type Palette,
  type SchemePreference,
} from '../../lib/appearance';
import { cn } from '../../lib/utils';

const SCHEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match phone' },
];

const PALETTE_NAMES: Record<Palette, string> = { mono: 'Mono', teal: 'Lagoon', indigo: 'Dusk', ember: 'Ember' };

/** "Dark · Dusk" — what the Appearance row says is set. */
export function describeAppearance(preference: SchemePreference, palette: Palette): string {
  const scheme = preference === 'system' ? 'Matches phone' : preference === 'dark' ? 'Dark' : 'Light';
  return `${scheme}, ${PALETTE_NAMES[palette]}`;
}

/**
 * Appearance (FEAT-016): the scheme — light, dark, or match the phone — and the colour
 * the app is painted in. Both apply as soon as they are chosen, with the circular reveal
 * growing from the option that was tapped.
 */
export function AppearanceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { preference, palette } = useAppearance();
  const swatches = useRef<Record<string, HTMLButtonElement | null>>({});

  function choosePalette(next: Palette) {
    const el = swatches.current[next];
    setPalette(next, el ? originOf(el) : undefined);
  }

  // A radio group: arrows move and choose, as in FilterChips.
  function onSwatchKey(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = PALETTES[(index + step + PALETTES.length) % PALETTES.length];
    choosePalette(next);
    swatches.current[next]?.focus();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Appearance" description="Applies to this phone only.">
      <div className="flex flex-col gap-6">
        <FilterChips
          label="Mode"
          options={SCHEME_OPTIONS}
          value={preference}
          // The circle grows from the chip that chose it — not from whatever had focus
          // (iOS does not focus a tapped button; arrow keys move focus after the change).
          onChange={(value, chip) => {
            setSchemePreference(value as SchemePreference, chip ? originOf(chip) : undefined);
          }}
        />

        <div className="flex flex-col gap-2">
          <span id="palette-label" className="term-label text-ink-soft">
            Colour
          </span>
          <div role="radiogroup" aria-labelledby="palette-label" className="grid grid-cols-4 gap-2.5">
            {PALETTES.map((p, index) => {
              const checked = p === palette;
              return (
                <button
                  key={p}
                  ref={(node) => {
                    swatches.current[p] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => choosePalette(p)}
                  onKeyDown={(event) => onSwatchKey(event, index)}
                  className={cn(
                    'chip press flex min-h-touch flex-col items-center gap-2 rounded-tile border p-3 t',
                    'focus-visible:shadow-focus focus-visible:outline-none',
                    checked ? 'border-brand/60 bg-brand/10 shadow-lift' : 'border-line/10 bg-paper/50 hover:bg-paper/80',
                  )}
                >
                  {/* Only the dot carries its palette (`data-theme`), so it shows that palette's
                      real colour whatever is active. On the whole button it re-applied that
                      palette's DAY ink to the label — dark text on a night sheet (FEAT-016
                      browser pass). */}
                  <span
                    aria-hidden="true"
                    data-theme={p}
                    className="paint-mono relative flex h-11 w-11 items-center justify-center rounded-full shadow-accent"
                  >
                    {checked && <Icon name="check" size={18} strokeWidth={2.6} className="animate-pop text-white" />}
                  </span>
                  <span className="text-meta font-bold text-ink">{PALETTE_NAMES[p]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
