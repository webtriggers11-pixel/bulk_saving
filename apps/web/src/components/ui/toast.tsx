import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Icon } from './icon';

export type ToastTone = 'slate' | 'amber';

interface ToastProps {
  /** Rendered content. Nothing is shown while this is null/undefined. */
  children?: ReactNode;
  tone?: ToastTone;
  /** Called when the auto-dismiss timer elapses or the close button is pressed. */
  onDismiss: () => void;
  /** Milliseconds before auto-dismiss. `null` keeps it up until dismissed. */
  duration?: number | null;
  /** Small label above the message, e.g. "DEV ONLY". */
  label?: string;
}

const TONES: Record<ToastTone, string> = {
  slate: 'bg-ink text-paper',
  amber: 'bg-ink text-paper ring-1 ring-amber-ink/40',
};

/**
 * A single transient message pinned to the bottom of the viewport.
 *
 * Deliberately minimal — one toast at a time, rendered by the page that owns it,
 * with no global provider or queue (CHORE-002 needed exactly one caller). It is
 * `role="status"` with `aria-live="polite"`, so a screen reader announces it
 * without stealing focus from the form underneath. FEAT-011 restyles it: it rises
 * from the bottom rather than appearing, and sits on the ink token so it reads as
 * the same product in every palette.
 */
export function Toast({ children, tone = 'slate', onDismiss, duration = 8_000, label }: ToastProps) {
  const visible = children !== null && children !== undefined && children !== false;

  useEffect(() => {
    if (!visible || duration === null) {
      return;
    }
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss, children]);

  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-tile px-4 py-3.5',
          'shadow-deep animate-rise',
          TONES[tone],
        )}
      >
        <div className="min-w-0 flex-1 text-caption">
          {label && (
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-60">
              {label}
            </p>
          )}
          <div className="break-words font-semibold">{children}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          // 44×44: the dismiss target was 32px, which the floor forbids — the glyph
          // stays small, the target does not (found by the strengthened AC6 test).
          className="t press -mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-chip border border-paper/15 bg-paper/10 opacity-80 hover:opacity-100"
        >
          <Icon name="close" size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
