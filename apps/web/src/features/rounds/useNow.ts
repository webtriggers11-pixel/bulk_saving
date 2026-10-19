import { useEffect, useState } from 'react';

/**
 * The current time, re-read every `ms` while `active` (FEAT-018 live countdown). Inactive
 * it never ticks, so a round days away costs no timer; the interval is cleared on unmount
 * and whenever `active` turns off.
 */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}
