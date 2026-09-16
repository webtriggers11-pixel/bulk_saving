import type { RoundTierDto } from '@bulk/shared';
import { computePricing } from './rounds.pricing';

/**
 * Pricing-rule unit tests (FEAT-003 T4). The tier math is the highest-risk pure
 * logic in the feature, so every boundary is pinned: below the first threshold,
 * exactly on a threshold, strictly between tiers, and above the top tier. The
 * function must also be order-independent (it sorts its input).
 */
describe('computePricing (tier math)', () => {
  // 5 units -> ₹900, 10 units -> ₹700. Deliberately passed out of order.
  const tiers: RoundTierDto[] = [
    { threshold: 10, price: 700 },
    { threshold: 5, price: 900 },
  ];

  it('below the lowest threshold: starting price + nextTier = lowest tier', () => {
    const p = computePricing(tiers, 0);
    expect(p.currentPrice).toBe(900);
    expect(p.nextTier).toEqual({ threshold: 5, price: 900 });
    expect(p.tiers).toEqual([
      { threshold: 5, price: 900 },
      { threshold: 10, price: 700 },
    ]);
  });

  it('just below the first threshold still shows the starting price', () => {
    const p = computePricing(tiers, 4);
    expect(p.currentPrice).toBe(900);
    expect(p.nextTier).toEqual({ threshold: 5, price: 900 });
  });

  it('exactly on the first threshold: that tier is current, next is the second', () => {
    const p = computePricing(tiers, 5);
    expect(p.currentPrice).toBe(900);
    expect(p.nextTier).toEqual({ threshold: 10, price: 700 });
  });

  it('between tiers: highest met tier is current, next is the tier above', () => {
    const p = computePricing(tiers, 7);
    expect(p.currentPrice).toBe(900);
    expect(p.nextTier).toEqual({ threshold: 10, price: 700 });
  });

  it('exactly on the top threshold: top price, no nextTier', () => {
    const p = computePricing(tiers, 10);
    expect(p.currentPrice).toBe(700);
    expect(p.nextTier).toBeUndefined();
  });

  it('above the top threshold: top price, no nextTier', () => {
    const p = computePricing(tiers, 25);
    expect(p.currentPrice).toBe(700);
    expect(p.nextTier).toBeUndefined();
  });

  it('single-tier round: below shows starting price + nextTier; at/above has no nextTier', () => {
    const single: RoundTierDto[] = [{ threshold: 3, price: 500 }];
    expect(computePricing(single, 0)).toEqual({
      tiers: single,
      currentPrice: 500,
      nextTier: { threshold: 3, price: 500 },
    });
    expect(computePricing(single, 3)).toEqual({ tiers: single, currentPrice: 500 });
    expect(computePricing(single, 9)).toEqual({ tiers: single, currentPrice: 500 });
  });
});
