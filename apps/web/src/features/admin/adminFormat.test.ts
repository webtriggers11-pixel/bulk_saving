import { describe, expect, it } from 'vitest';
import { timeAgo } from './adminFormat';

describe('timeAgo (BUG-029)', () => {
  const now = new Date('2026-11-22T12:00:00.000Z').getTime();
  it.each([
    ['2026-11-22T11:59:40.000Z', 'just now'],
    ['2026-11-22T11:57:00.000Z', '3 min ago'],
    ['2026-11-22T09:00:00.000Z', '3 h ago'],
    ['2026-11-21T09:00:00.000Z', '1 day ago'],
    ['2026-11-12T12:00:00.000Z', '10 days ago'],
  ])('%s → %s', (iso, label) => {
    expect(timeAgo(iso, now)).toBe(label);
  });
});
