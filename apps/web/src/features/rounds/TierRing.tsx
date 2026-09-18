import { useId } from 'react';

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface TierRingProps {
  /** Accessible name, e.g. "Painting: progress to the next price". */
  label: string;
  /** 0–100. Drives the arc; the label below is the caller's own copy. */
  percent: number;
  /** Big number inside the ring — the live unit count. */
  value: number | string;
  /** The service's own word for a unit, e.g. "rooms". */
  unitLabel: string;
  size?: number;
}

/**
 * The tier gauge (FEAT-011): how close this round is to its next price. A ring
 * rather than a second bar, because on the hero card the number belongs INSIDE the
 * progress — "18 rooms, 72% of the way" is one fact, not two.
 *
 * The arc transitions rather than jumps, so a pledge visibly moves the round.
 */
export function TierRing({ percent, value, unitLabel, label, size = 108 }: TierRingProps) {
  const gradientId = useId();
  const offset = CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, percent)) / 100);
  return (
    // The ring REPLACED a <div role="progressbar">; the role has to come with it,
    // or a screen-reader user loses the tier progress entirely (V2 P2-1).
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true" className="block">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="[stop-color:rgb(var(--brand-deep))]" />
            <stop offset="1" className="[stop-color:rgb(var(--brand-light))]" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={RADIUS} fill="none" strokeWidth="7" className="stroke-shade/15" />
        <circle
          cx="40"
          cy="40"
          r={RADIUS}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          strokeDasharray={CIRCUMFERENCE.toFixed(2)}
          strokeDashoffset={offset.toFixed(2)}
          transform="rotate(-90 40 40)"
          className="transition-[stroke-dashoffset] duration-500 ease-entrance drop-shadow-[0_4px_9px_rgb(var(--brand)/0.5)]"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-[25px] font-extrabold leading-none text-ink">{value}</span>
        <span className="mt-1 text-[9.5px] font-extrabold uppercase tracking-[0.11em] text-ink-soft">
          {unitLabel}
        </span>
      </div>
    </div>
  );
}
