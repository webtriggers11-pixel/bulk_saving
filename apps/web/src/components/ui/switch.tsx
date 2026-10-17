import { cn } from '../../lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The accessible name — say what is being switched, e.g. "Water Tank Cleaning active". */
  label: string;
  disabled?: boolean;
  /**
   * A save is in flight: taps are ignored, but the switch stays focusable. `disabled`
   * here dropped keyboard focus off the control the admin had just pressed (V2 P2-3).
   */
  busy?: boolean;
  /** Shown beside the track, e.g. "Active" / "Inactive". Purely visual; `label` is the name. */
  text?: string;
  className?: string;
}

/**
 * An on/off switch (FEAT-015) — `role="switch"`, so a screen reader announces on or off
 * rather than pressed or not pressed. Space and Enter toggle it, as a native button does.
 *
 * The knob overshoots slightly on its way across and squashes under the finger
 * (`.switch`, theme.css). It reflects `checked` immediately; the caller decides
 * whether that is optimistic or waits for the server.
 */
export function Switch({ checked, onChange, label, disabled, busy, text, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => {
        if (!busy) {
          onChange(!checked);
        }
      }}
      className={cn(
        'switch group inline-flex min-h-touch items-center gap-2.5 rounded-full text-meta font-bold text-ink-muted',
        'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'switch-track relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1',
          'group-focus-visible:shadow-focus',
          checked ? 'bg-brand shadow-glow' : 'bg-line/20',
        )}
      >
        <span className="switch-knob block h-5 w-5 rounded-full bg-white shadow-field" />
      </span>
      {/* The state, for sighted users. Hidden from assistive tech: aria-checked already
          says it, and the accessible name is `label`, which names the thing switched. */}
      {text && (
        <span aria-hidden="true" className={checked ? 'text-ink' : undefined}>
          {text}
        </span>
      )}
    </button>
  );
}
