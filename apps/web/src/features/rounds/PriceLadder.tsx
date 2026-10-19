import type { RoundDto } from '@bulk/shared';
import { cn } from '../../lib/utils';
import { formatUnits } from '../../lib/units';
import { formatRupees } from './formatPrice';
import { ladderFill, moreUnits, reachedTiers, sortedTiers, unitsToNext } from './roundMath';

/**
 * The price ladder (FEAT-018): the whole point of a group buy, drawn — every tier as a
 * step, the round's live position as a fill, and how far the next step is.
 *
 * The track and its dots are decoration (`aria-hidden`); the tiers are an ordered list
 * whose text says the same thing, including which steps are reached and which is next.
 * A single-tier round has no ladder to climb, so it renders nothing — the ring and the
 * tier line already say everything there is.
 */
export function PriceLadder({ round }: { round: RoundDto }) {
  const tiers = sortedTiers(round);
  if (tiers.length < 2) return null;
  const reached = reachedTiers(round);
  const fill = ladderFill(round);
  const toGo = unitsToNext(round);
  // Below the first tier the next step is the go/no-go line, not a cheaper price (CHORE-010).
  const goesAhead = round.nextTier ? round.nextTier.price >= round.currentPrice : false;

  return (
    <div className="mt-4" data-testid={`ladder-${round.id}`}>
      <div aria-hidden="true" className="relative mx-2 h-1.5 rounded-full bg-line/10">
        <span
          className="bar-fill block h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-500 ease-entrance"
          style={{ width: `${fill}%` }}
        />
        {tiers.map((tier, index) => (
          <span
            key={tier.threshold}
            className={cn(
              'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 t',
              index < reached
                ? 'border-brand bg-brand'
                : index === reached
                  ? 'animate-pulse-ring border-brand bg-paper'
                  : 'border-line/20 bg-paper',
            )}
            style={{ left: `${((index + 1) / tiers.length) * 100}%` }}
          />
        ))}
      </div>

      <ol
        aria-label="Price ladder"
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${tiers.length}, minmax(0, 1fr))` }}
      >
        {tiers.map((tier, index) => (
          <li key={tier.threshold} className="text-right" data-reached={index < reached || undefined}>
            <span
              className={cn(
                'num block text-caption font-extrabold',
                index < reached ? 'text-brand-ink' : index === reached ? 'text-ink' : 'text-ink-soft',
              )}
            >
              {formatRupees(tier.price)}
            </span>
            <span className="block text-micro text-ink-soft">{formatUnits(tier.threshold, round.service)}</span>
            {index < reached && <span className="sr-only-text">, reached</span>}
            {index === reached && <span className="sr-only-text">, next</span>}
          </li>
        ))}
      </ol>

      {toGo > 0 && round.nextTier && (
        <p className="mt-3 text-meta text-ink-muted" data-testid={`to-go-${round.id}`}>
          <span className="num font-extrabold text-ink">{moreUnits(toGo, round)}</span>
          {goesAhead ? ' and this round goes ahead' : ` and everyone pays ${formatRupees(round.nextTier.price)}`}
        </p>
      )}
    </div>
  );
}
