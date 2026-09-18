import { useEffect, useState } from 'react';

/** ms the first paint spends counting a live number up from zero. */
const DURATION = 1_100;

/**
 * Counts a number up on mount, then tracks it exactly (FEAT-011).
 *
 * The rule that makes it safe: if we cannot ASK whether motion is welcome —
 * `matchMedia` missing (jsdom, older WebViews) — we do not animate. So tests and
 * assistive setups read the true value on the first render, and only a browser that
 * has said it is happy with motion sees the count.
 *
 * Only the intro animates. Once a resident taps +, the number is theirs and must
 * answer immediately.
 */
export function useCountUp(target: number): number {
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(() => !prefersMotion());

  useEffect(() => {
    if (done) {
      return;
    }
    const start = Date.now();
    let frame = requestAnimationFrame(function step() {
      const progress = Math.min(1, (Date.now() - start) / DURATION);
      // ease-out cubic: fast enough to feel instant, slow enough to be read
      setShown(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        setDone(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [done, target]);

  return done ? target : shown;
}

function prefersMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
