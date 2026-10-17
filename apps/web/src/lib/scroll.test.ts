import { describe, expect, it } from 'vitest';
import { scrollIntoRail } from './scroll';

const box = (left: number, right: number) => ({ getBoundingClientRect: () => ({ left, right }) });

describe('scrollIntoRail', () => {
  it('leaves the rail alone when the chip is already visible', () => {
    const rail = { scrollLeft: 40, ...box(0, 300) };
    scrollIntoRail(rail, box(100, 180));
    expect(rail.scrollLeft).toBe(40);
  });

  it('scrolls right just far enough to show a chip past the end, plus a margin', () => {
    const rail = { scrollLeft: 0, ...box(0, 300) };
    scrollIntoRail(rail, box(320, 420));
    expect(rail.scrollLeft).toBe(132);
  });

  it('scrolls left for a chip before the start', () => {
    const rail = { scrollLeft: 200, ...box(0, 300) };
    scrollIntoRail(rail, box(-50, 40));
    expect(rail.scrollLeft).toBe(138);
  });
});
