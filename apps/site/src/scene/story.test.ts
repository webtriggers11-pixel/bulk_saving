import { describe, expect, it } from 'vitest';
import { STEPS, stepAt, storyAt } from './story';
import { demoRound } from '../content/features';

const target = demoRound.tiers[demoRound.tiers.length - 1]!.units;

describe('stepAt', () => {
  it('splits progress into four steps with a local 0..1', () => {
    expect(stepAt(0)).toEqual({ step: 0, k: 0 });
    expect(stepAt(0.125)).toEqual({ step: 0, k: 0.5 });
    expect(stepAt(0.25).step).toBe(1);
    expect(stepAt(0.5).step).toBe(2);
    expect(stepAt(0.75).step).toBe(3);
    expect(stepAt(1)).toEqual({ step: STEPS - 1, k: 1 });
    expect(stepAt(-3).step).toBe(0);
    expect(stepAt(9).step).toBe(3);
  });
});

describe('storyAt', () => {
  it('starts flat and far, rises during the first step', () => {
    expect(storyAt(0).view.rise).toBe(0);
    expect(storyAt(0).units).toBe(0);
    const mid = storyAt(0.12);
    expect(mid.view.rise).toBeGreaterThan(0.5);
    expect(storyAt(0.24).view.rise).toBe(1);
    expect(storyAt(0.24).units).toBe(demoRound.startUnits);
  });
  it('your pledge lands in step 1 and the camera comes closer', () => {
    expect(storyAt(0.26).units).toBe(demoRound.startUnits);
    expect(storyAt(0.45).units).toBe(demoRound.startUnits + 2);
    expect(storyAt(0.49).view.zoom).toBeGreaterThan(storyAt(0.26).view.zoom);
  });
  it('neighbours fill the round to the target in step 2, price falling monotonically', () => {
    let lastPrice = Infinity;
    let lastUnits = -1;
    for (let p = 0.5; p <= 0.75; p += 0.01) {
      const s = storyAt(p);
      expect(s.units).toBeGreaterThanOrEqual(lastUnits);
      expect(s.price).toBeLessThanOrEqual(lastPrice);
      lastPrice = s.price;
      lastUnits = s.units;
    }
    expect(storyAt(0.749).units).toBe(target);
    expect(storyAt(0.749).price).toBe(700);
  });
  it('the deadline closes it once, early in step 3, then rests', () => {
    expect(storyAt(0.76).closed).toBe(false);
    expect(storyAt(0.8).closed).toBe(true);
    expect(storyAt(0.95).closed).toBe(false);
    expect(storyAt(1).units).toBe(target + 1);
    expect(storyAt(1).price).toBe(700);
  });
  it('the view is continuous across step boundaries', () => {
    for (const edge of [0.25, 0.5, 0.75]) {
      const a = storyAt(edge - 0.0001).view;
      const b = storyAt(edge + 0.0001).view;
      for (const key of ['yaw', 'pitch', 'zoom', 'rise'] as const) {
        expect(Math.abs(a[key] - b[key]), `${key} at ${edge}`).toBeLessThan(0.02);
      }
    }
  });
});
