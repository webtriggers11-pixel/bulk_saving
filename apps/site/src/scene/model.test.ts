import { describe, expect, it } from 'vitest';
import {
  WINDOWS_PER_UNIT,
  allWindows,
  ladderProgress,
  lightingOrder,
  litCount,
  litSet,
  nextTier,
  priceFor,
  rupees,
  savingPerUnit,
  tierIndex,
  unlocked,
} from './model';
import { demoRound } from '../content/features';

const tiers = demoRound.tiers;

describe('tiers (the app’s rule: highest tier whose threshold is met)', () => {
  it('prices', () => {
    expect(priceFor(tiers, 0)).toBe(1000);
    expect(priceFor(tiers, 1)).toBe(1000);
    expect(priceFor(tiers, 4)).toBe(1000);
    expect(priceFor(tiers, 5)).toBe(800);
    expect(priceFor(tiers, 9)).toBe(800);
    expect(priceFor(tiers, 10)).toBe(700);
    expect(priceFor(tiers, 40)).toBe(700);
  });
  it('tier index and next tier', () => {
    expect(tierIndex(tiers, 0)).toBe(-1);
    expect(tierIndex(tiers, 3)).toBe(0);
    expect(tierIndex(tiers, 10)).toBe(2);
    expect(nextTier(tiers, 3)).toEqual({ units: 5, price: 800 });
    expect(nextTier(tiers, 5)).toEqual({ units: 10, price: 700 });
    expect(nextTier(tiers, 10)).toBeNull();
  });
  it('unlocks only on crossing a threshold', () => {
    expect(unlocked(tiers, 3, 4)).toBe(false);
    expect(unlocked(tiers, 4, 5)).toBe(true);
    expect(unlocked(tiers, 5, 9)).toBe(false);
    expect(unlocked(tiers, 9, 11)).toBe(true);
    expect(unlocked(tiers, 11, 12)).toBe(false);
    expect(unlocked(tiers, 5, 3)).toBe(false);
  });
  it('progress and saving', () => {
    expect(ladderProgress(tiers, 0)).toBe(0);
    expect(ladderProgress(tiers, 5)).toBe(0.5);
    expect(ladderProgress(tiers, 25)).toBe(1);
    expect(savingPerUnit(tiers, 3)).toBe(0);
    expect(savingPerUnit(tiers, 6)).toBe(200);
    expect(savingPerUnit(tiers, 10)).toBe(300);
  });
  it('throws on an empty ladder', () => {
    expect(() => priceFor([], 1)).toThrow();
  });
});

describe('rupees (Indian grouping)', () => {
  it('formats', () => {
    expect(rupees(0)).toBe('₹0');
    expect(rupees(700)).toBe('₹700');
    expect(rupees(1000)).toBe('₹1,000');
    expect(rupees(41300)).toBe('₹41,300');
    expect(rupees(125000)).toBe('₹1,25,000');
    expect(rupees(-1400)).toBe('-₹1,400');
  });
});

describe('the society', () => {
  const wins = allWindows();
  it('has two faces per tower, every floor and column', () => {
    expect(wins.length).toBe((8 * 4 + 5 * 3) * 2);
    expect(wins.filter((w) => w.face === 'front').length).toBe(wins.length / 2);
  });
  it('lighting order is a deterministic permutation', () => {
    const a = lightingOrder(wins.length);
    const b = lightingOrder(wins.length);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(wins.map((_, i) => i));
    expect(a).not.toEqual(wins.map((_, i) => i));
    expect(lightingOrder(wins.length, 99)).not.toEqual(a);
  });
  it('a unit lights a flat’s worth of windows, capped at the society', () => {
    expect(litCount(0, 94)).toBe(0);
    expect(litCount(1, 94)).toBe(WINDOWS_PER_UNIT);
    expect(litCount(10, 94)).toBe(30);
    expect(litCount(100, 94)).toBe(94);
    const order = lightingOrder(wins.length);
    expect(litSet(order, 2).size).toBe(6);
    // earlier pledges stay lit as more join
    const s3 = litSet(order, 3);
    const s5 = litSet(order, 5);
    for (const i of s3) expect(s5.has(i)).toBe(true);
  });
});
