import { describe, expect, it } from 'vitest';
import { WINDOWS_PER_UNIT, allWindows, flatLabel, flatOf, lightingOrder, litSet, promote } from './model';

const wins = allWindows();

describe('flatLabel (FEAT-030)', () => {
  it('names tower, floor and column', () => {
    expect(flatLabel({ tower: 0, face: 'front', floor: 5, col: 3 })).toBe('A-604');
    expect(flatLabel({ tower: 1, face: 'side', floor: 0, col: 0 })).toBe('B-105');
  });
  it('gives every visible window a distinct name', () => {
    expect(new Set(wins.map(flatLabel)).size).toBe(wins.length);
  });
});

describe('flatOf', () => {
  it('starts with the tapped window and stays on its tower, face and floor', () => {
    const idx = wins.findIndex((w) => w.tower === 0 && w.face === 'front' && w.floor === 3 && w.col === 0);
    const flat = flatOf(wins, idx);
    expect(flat[0]).toBe(idx);
    expect(flat).toHaveLength(WINDOWS_PER_UNIT);
    for (const i of flat) {
      const w = wins[i]!;
      expect([w.tower, w.face, w.floor]).toEqual([0, 'front', 3]);
    }
    expect(flat.map((i) => wins[i]!.col)).toEqual([0, 1, 2]);
  });
  it('takes nearest neighbours first from a middle column', () => {
    const idx = wins.findIndex((w) => w.tower === 1 && w.face === 'side' && w.floor === 2 && w.col === 1);
    expect(flatOf(wins, idx).map((i) => wins[i]!.col)).toEqual([1, 0, 2]);
  });
  it('is empty for an index out of range', () => {
    expect(flatOf(wins, -1)).toEqual([]);
    expect(flatOf(wins, wins.length)).toEqual([]);
  });
});

describe('promote', () => {
  const order = lightingOrder(wins.length);
  it('lights exactly the promoted windows on the next unit, keeping what was lit', () => {
    const litN = 9;
    const flat = flatOf(wins, order[60]!);
    const next = promote(order, litN, flat);
    expect(next).toHaveLength(order.length);
    expect(new Set(next).size).toBe(order.length);
    expect(next.slice(0, litN)).toEqual(order.slice(0, litN));
    const before = litSet(next, 3);
    const after = litSet(next, 4);
    expect([...after].filter((i) => !before.has(i)).sort()).toEqual([...flat].sort());
  });
  it('leaves already-lit windows where they are', () => {
    const next = promote(order, 9, [order[2]!, order[50]!]);
    expect(next.slice(0, 9)).toEqual(order.slice(0, 9));
    expect(next[9]).toBe(order[50]);
  });
  it('ignores duplicates and unknown indices', () => {
    const next = promote(order, 0, [order[5]!, order[5]!, 9999]);
    expect(next[0]).toBe(order[5]);
    expect(next).toHaveLength(order.length);
    expect(new Set(next).size).toBe(order.length);
  });
});
