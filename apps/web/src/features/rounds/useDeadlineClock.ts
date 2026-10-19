import { useEffect, useState } from 'react';

const DAY_MS = 24 * 60 * 60 * 1000;
/** setTimeout's ceiling; a boundary further out than ~24.8 days is never waited on. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * A round's deadline as a clock (FEAT-018). Inside its last day the round is `urgent` and
 * `now` advances once a second; further out there is no interval at all — just one
 * timeout set for the moment the last day begins, so a card left open on screen starts
 * ticking on its own (V2 P3-1) instead of when something else happens to re-render it.
 * Both timers are cleared on unmount and whenever the deadline changes.
 */
export function useDeadlineClock(deadlineIso: string): { now: number; urgent: boolean } {
  const deadline = new Date(deadlineIso).getTime();
  const [now, setNow] = useState(() => Date.now());
  const remaining = deadline - now;
  const urgent = remaining > 0 && remaining < DAY_MS;

  useEffect(() => {
    if (urgent) {
      const id = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(id);
    }
    const untilLastDay = deadline - DAY_MS - Date.now();
    if (untilLastDay > 0 && untilLastDay < MAX_TIMEOUT_MS) {
      const id = window.setTimeout(() => setNow(Date.now()), untilLastDay + 50);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [urgent, deadline]);

  return { now, urgent };
}
