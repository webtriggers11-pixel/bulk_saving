import type { RoundTierDto } from '@bulk/shared';

/** The outcome of evaluating a round's tiers against its current unit count. */
export interface Pricing {
  /** Sorted (ascending threshold) tiers as the client should display them. */
  tiers: RoundTierDto[];
  /** The price currently in effect (integer rupees). */
  currentPrice: number;
  /** The next threshold to unlock, or undefined once the top tier is reached. */
  nextTier?: RoundTierDto;
}

/**
 * The FEAT-003 pricing rule (ADR-0010), the single source of tier math.
 *
 * Given price tiers (each `threshold` units → `price`) and the round's current
 * `unitsCount`:
 *  - Tiers are sorted ascending by threshold.
 *  - `currentPrice` = the price of the HIGHEST tier whose threshold <= unitsCount.
 *  - If `unitsCount` is below the lowest threshold, nothing is unlocked yet:
 *    `currentPrice` shows the lowest tier's price as the starting/not-yet-unlocked
 *    price, and `nextTier` is that lowest tier.
 *  - Otherwise `nextTier` is the first tier whose threshold is strictly greater
 *    than `unitsCount`; it is undefined once the top tier's threshold is met.
 *
 * Assumes at least one tier (rounds are always created with a non-empty tier set).
 */
export function computePricing(tiers: readonly RoundTierDto[], unitsCount: number): Pricing {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  const lowest = sorted[0];

  // Below the first threshold: nothing unlocked; show the starting price.
  if (unitsCount < lowest.threshold) {
    return { tiers: sorted, currentPrice: lowest.price, nextTier: lowest };
  }

  // Highest met tier sets the current price; the first higher tier is "next".
  let currentPrice = lowest.price;
  let nextTier: RoundTierDto | undefined;
  for (const tier of sorted) {
    if (tier.threshold <= unitsCount) {
      currentPrice = tier.price;
    } else {
      nextTier = tier;
      break;
    }
  }

  return nextTier ? { tiers: sorted, currentPrice, nextTier } : { tiers: sorted, currentPrice };
}
