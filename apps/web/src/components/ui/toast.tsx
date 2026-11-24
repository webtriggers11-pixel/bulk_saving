import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
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
  /** Where it pins. `bottom` (default) rises from the bottom; `top` drops in under the status bar. */
  placement?: 'bottom' | 'top';
  /** An action beside the message, e.g. "Use it". */
  action?: ReactNode;
  /**
   * FEAT-042 V2 P1-1: step aside while another top toast is up. The install ask yields, so it
   * never covers the dev OTP code on sign-in. Only meaningful with `placement="top"`.
   */
  yieldTop?: boolean;
}

/**
 * Top toasts that hold the slot right now (visible, not yielding). Module scope, because the
 * two callers live in different trees (the install ask at the app root, the OTP code on a page).
 */
const topHolders = new Set<symbol>();
const topListeners = new Set<() => void>();
function notifyTop(): void {
  for (const listener of topListeners) listener();
}
function subscribeTop(listener: () => void): () => void {
  topListeners.add(listener);
  return () => topListeners.delete(listener);
}
const topBusy = (): boolean => topHolders.size > 0;

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
export function Toast({ children, tone = 'slate', onDismiss, duration = 8_000, label, placement = 'bottom', action, yieldTop = false }: ToastProps) {
  const visible = children !== null && children !== undefined && children !== false;
  const holdsTop = visible && placement === 'top' && !yieldTop;
  const othersOnTop = useSyncExternalStore(subscribeTop, topBusy, topBusy);

  useEffect(() => {
    if (!holdsTop) return;
    const token = Symbol('top-toast');
    topHolders.add(token);
    notifyTop();
    return () => {
      topHolders.delete(token);
      notifyTop();
    };
  }, [holdsTop]);

  useEffect(() => {
    if (!visible || duration === null) {
      return;
    }
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss, children]);

  if (!visible || (yieldTop && othersOnTop)) {
    return null;
  }

  return (
    <div
      className={cn(
        // Axis paddings, not `p-4` + a `pt-*` override: the same element must not carry a
        // shorthand and one of its sides (BUG-007's rule), whichever placement wins.
        'pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 pb-4',
        placement === 'top' ? 'top-0 pt-[max(env(safe-area-inset-top),16px)]' : 'bottom-0 pt-4',
      )}
      data-placement={placement}
    >
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
        {action}
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
