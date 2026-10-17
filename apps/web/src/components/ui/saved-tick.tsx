import { useEffect, useState } from 'react';
import { Icon } from './icon';

/** How long the tick stays mounted — the length of `saved-flash` in theme.css. */
const SAVED_TICK_MS = 1800;

/**
 * "Saved" confirmation for an inline admin edit (FEAT-015). Pass a value that changes on
 * every successful save — a mutation's `submittedAt` is ideal — and the tick plays once,
 * then unmounts. `role="status"` announces it without moving focus.
 *
 * Without it a save that succeeds looks exactly like a tap that did nothing, because the
 * row simply re-renders with the value the admin already typed.
 */
export function SavedTick({ trigger, text = 'Saved' }: { trigger: number | null; text?: string }) {
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!trigger) {
      return;
    }
    setShown(trigger);
    const timer = setTimeout(() => setShown(null), SAVED_TICK_MS);
    return () => clearTimeout(timer);
  }, [trigger]);

  // The live region exists only while the tick does. One always-mounted region per row
  // put two dozen silent status regions on the services page (V2 P2-4); a status region
  // inserted with its content is announced by current screen readers.
  if (shown === null) {
    return null;
  }
  return (
    <span
      key={shown}
      role="status"
      className="animate-saved inline-flex items-center gap-1.5 rounded-full bg-success-ink/10 px-2.5 py-1 text-meta font-bold text-success-ink"
    >
      <Icon name="check" size={14} strokeWidth={2.6} />
      {text}
    </span>
  );
}
