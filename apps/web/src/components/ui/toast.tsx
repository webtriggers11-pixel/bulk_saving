import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

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
  slate: 'bg-slate-900 text-white',
  amber: 'bg-amber-950 text-amber-50 ring-1 ring-amber-400/40',
};

/**
 * A single transient message pinned to the bottom of the viewport.
 *
 * Deliberately minimal — one toast at a time, rendered by the page that owns it,
 * with no global provider or queue (CHORE-002 needed exactly one caller). It is
 * `role="status"` with `aria-live="polite"`, so a screen reader announces it
 * without stealing focus from the form underneath.
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
          'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 shadow-lg',
          TONES[tone],
        )}
      >
        <div className="min-w-0 flex-1 text-sm">
          {label && (
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest opacity-80">
              {label}
            </p>
          )}
          <div className="break-words">{children}</div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 shrink-0 rounded-md px-1.5 text-lg leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
