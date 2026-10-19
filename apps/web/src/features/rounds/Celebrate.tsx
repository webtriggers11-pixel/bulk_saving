/**
 * A burst of confetti (FEAT-018): a pledge saved, or a round reaching a cheaper tier
 * while it is on screen. Mount with a new `burst` number to play it again; 0 plays
 * nothing. CSS only (`animate-confetti` in theme.css), no dependency, and nothing at all
 * under reduced motion — here, and again in the stylesheet's reduced-motion block.
 *
 * Positions are derived from the index, not random, so a render is reproducible.
 */
const PIECES = 16;
const TONES = ['bg-brand', 'bg-star', 'bg-success-ink', 'bg-info-ink', 'bg-brand-light'] as const;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export function Celebrate({ burst }: { burst: number }) {
  if (burst === 0 || prefersReducedMotion()) return null;
  return (
    <span key={burst} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10" data-testid="celebrate">
      {Array.from({ length: PIECES }, (_, index) => {
        const angle = (index / PIECES) * Math.PI * 2 + 0.3;
        const distance = index % 2 === 0 ? 92 : 64;
        return (
          <span
            key={index}
            className={`animate-confetti absolute left-0 top-0 h-2 w-1.5 rounded-[1px] ${TONES[index % TONES.length]}`}
            style={{
              // One keyframe, sixteen destinations: CSS custom properties per piece.
              ['--dx' as string]: `${Math.round(Math.cos(angle) * distance)}px`,
              // A little gravity: everything ends lower than it would on a pure circle.
              ['--dy' as string]: `${Math.round(Math.sin(angle) * distance * 0.8 + 26)}px`,
              ['--rot' as string]: `${(index % 2 === 0 ? 1 : -1) * (200 + index * 25)}deg`,
              animationDelay: `${(index % 4) * 30}ms`,
            }}
          />
        );
      })}
    </span>
  );
}
