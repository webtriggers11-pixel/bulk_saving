import { describe, expect, it } from 'vitest';
import { DEFAULTS, calc, compactRupees } from './calc';

describe('calc', () => {
  it('the BRIEF example: ₹1,000 → ₹700 saves ₹300 a job', () => {
    const o = calc(DEFAULTS);
    expect(o.pooledPrice).toBe(700);
    expect(o.savingPerJob).toBe(300);
    expect(o.jobs).toBe(200 * 0.3 * 2);
    expect(o.societySavings).toBe(120 * 300);
    expect(o.perFlatSavings).toBe(Math.round((120 * 300) / 200));
    expect(o.gmv).toBe(120 * 700);
    expect(o.platformRevenue).toBe(Math.round(120 * 700 * 0.1));
  });
  it('scales linearly with flats and clamps nonsense', () => {
    expect(calc({ ...DEFAULTS, flats: 400 }).societySavings).toBe(2 * calc(DEFAULTS).societySavings);
    expect(calc({ ...DEFAULTS, flats: -5 }).jobs).toBe(Math.round(1 * 0.3 * 2));
    expect(calc({ ...DEFAULTS, discount: 2 }).pooledPrice).toBe(100);
    expect(calc({ ...DEFAULTS, takeRate: 9 }).platformRevenue).toBe(Math.round(calc(DEFAULTS).gmv * 0.5));
    expect(calc({ ...DEFAULTS, joining: 0 }).societySavings).toBe(0);
  });
});

describe('compactRupees', () => {
  it('uses lakh and crore', () => {
    expect(compactRupees(36000)).toBe('₹36,000');
    expect(compactRupees(240000)).toBe('₹2.4 L');
    expect(compactRupees(1250000)).toBe('₹13 L');
    expect(compactRupees(12000000)).toBe('₹1.2 Cr');
    expect(compactRupees(-500)).toBe('-₹500');
  });
});
