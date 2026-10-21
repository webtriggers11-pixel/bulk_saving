import { describe, expect, it } from 'vitest';
import { askLabel, closesIn, filterCatalog, sheetFor, toggleAsk } from './catalogModel';
import { CATEGORIES, catalog } from '../content/features';

describe('filterCatalog', () => {
  it('all + empty query is everything', () => {
    expect(filterCatalog(catalog, { category: 'all', q: '' }).length).toBe(catalog.length);
  });
  it('a chip narrows to its category; every category has items', () => {
    for (const c of CATEGORIES) {
      const out = filterCatalog(catalog, { category: c, q: '' });
      expect(out.length).toBeGreaterThan(0);
      expect(out.every((i) => i.category === c)).toBe(true);
    }
  });
  it('search is case-insensitive, trimmed, combined with the chip', () => {
    expect(filterCatalog(catalog, { category: 'all', q: '  CAR ' }).map((i) => i.name)).toEqual(['Doorstep car wash', 'Car interior detailing']);
    expect(filterCatalog(catalog, { category: 'Home Care', q: 'clean' }).map((i) => i.name)).toEqual(['Deep cleaning', 'Mattress cleaning']);
    expect(filterCatalog(catalog, { category: 'Vehicle', q: 'rice' })).toEqual([]);
  });
});

describe('closesIn', () => {
  it('words the deadline', () => {
    expect(closesIn(52)).toBe('closes in 2d 4h');
    expect(closesIn(48)).toBe('closes in 2d');
    expect(closesIn(5.5)).toBe('closes in 5h 30m');
    expect(closesIn(20)).toBe('closes in 20h');
    expect(closesIn(0.5)).toBe('closes in 30m');
    expect(closesIn(0)).toBe('closing now');
    expect(closesIn(-3)).toBe('closing now');
  });
});

describe('asks', () => {
  it('toggles by one and never goes below zero', () => {
    expect(toggleAsk(4, false)).toEqual({ count: 5, asked: true });
    expect(toggleAsk(5, true)).toEqual({ count: 4, asked: false });
    expect(toggleAsk(0, true)).toEqual({ count: 0, asked: false });
  });
  it('labels', () => {
    expect(askLabel(0, false)).toBe('No one has asked yet');
    expect(askLabel(1, false)).toBe('1 neighbour asked');
    expect(askLabel(4, false)).toBe('4 neighbours asked');
    expect(askLabel(1, true)).toBe('You asked');
    expect(askLabel(2, true)).toBe('You and 1 neighbour asked');
    expect(askLabel(5, true)).toBe('You and 4 neighbours asked');
  });
});

describe('sheetFor', () => {
  const round = catalog.find((c) => c.name === 'AC servicing')!.round!;
  const noun = { one: 'AC unit', many: 'AC units' };
  it('prices the round after your units and totals them', () => {
    const s = sheetFor(round, 2, noun);
    expect(s).toEqual({ units: 2, priceNow: 449, total: 898, hint: '2 more AC units unlock ₹399 for everyone' });
    expect(sheetFor(round, 3, noun).hint).toBe('1 more AC unit unlocks ₹399 for everyone');
    expect(sheetFor(round, 4, noun).hint).toBe('Best price unlocked for everyone');
    expect(sheetFor(round, 4, noun).total).toBe(399 * 4);
  });
  it('clamps units to 1..9', () => {
    expect(sheetFor(round, 0, noun).units).toBe(1);
    expect(sheetFor(round, 40, noun).units).toBe(9);
  });
});
