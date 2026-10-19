import { describe, expect, it } from 'vitest';
import { bestSavingForMe, ladderFill, maxSavingPerUnit, reachedTiers, sortedTiers, unitsToNext } from './roundMath';

// Deliberately out of order: the API does not promise a sort.
const tiers = [
  { threshold: 50, price: 600 },
  { threshold: 10, price: 900 },
  { threshold: 25, price: 750 },
];

describe('roundMath (FEAT-018)', () => {
  it('climbs tiers lowest threshold first', () => {
    expect(sortedTiers({ tiers }).map((t) => t.threshold)).toEqual([10, 25, 50]);
  });

  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [24, 1],
    [25, 2],
    [50, 3],
    [80, 3],
  ])('%i units have reached %i tiers', (unitsCount, reached) => {
    expect(reachedTiers({ tiers, unitsCount })).toBe(reached);
  });

  it('counts the units still needed, and none at the top', () => {
    expect(unitsToNext({ unitsCount: 7, nextTier: { threshold: 10, price: 900 } })).toBe(3);
    expect(unitsToNext({ unitsCount: 60, nextTier: undefined })).toBe(0);
  });

  it('spaces the steps evenly on the ladder, linear within a step', () => {
    expect(ladderFill({ tiers, unitsCount: 0 })).toBe(0);
    expect(ladderFill({ tiers, unitsCount: 5 })).toBe(17); // half of step 1 of 3
    expect(ladderFill({ tiers, unitsCount: 10 })).toBe(33);
    expect(ladderFill({ tiers, unitsCount: 25 })).toBe(67);
    expect(ladderFill({ tiers, unitsCount: 50 })).toBe(100);
    expect(ladderFill({ tiers, unitsCount: 999 })).toBe(100);
    expect(ladderFill({ tiers: [], unitsCount: 4 })).toBe(0);
  });

  it('saves first-tier minus best-tier per unit, and sums it over joined rounds only', () => {
    expect(maxSavingPerUnit({ tiers })).toBe(300);
    expect(maxSavingPerUnit({ tiers: [{ threshold: 5, price: 500 }] })).toBe(0);
    expect(
      bestSavingForMe([
        { tiers, myUnits: 2 }, // 600
        { tiers, myUnits: 0 }, // not joined
        { tiers: [{ threshold: 4, price: 400 }, { threshold: 8, price: 350 }], myUnits: 3 }, // 150
      ]),
    ).toBe(750);
  });
});
