import { describe, expect, it } from 'vitest';
import { formatCountdown } from './formatCountdown';

/** Fixed clock so the relative countdown is deterministic. */
const NOW = new Date('2026-09-17T12:00:00.000Z');

/** Build an ISO deadline `ms` in the future from the fixed clock. */
function inMs(ms: number): string {
  return new Date(NOW.getTime() + ms).toISOString();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatCountdown', () => {
  it('formats multiple days', () => {
    expect(formatCountdown(inMs(4 * DAY), NOW)).toBe('Closes in 4 days');
  });

  it('uses the singular for exactly one day', () => {
    expect(formatCountdown(inMs(DAY + HOUR), NOW)).toBe('Closes in 1 day');
  });

  it('formats hours when under a day', () => {
    expect(formatCountdown(inMs(6 * HOUR), NOW)).toBe('Closes in 6h');
  });

  it('formats minutes when under an hour', () => {
    expect(formatCountdown(inMs(45 * MINUTE), NOW)).toBe('Closes in 45m');
  });

  it('reads "Closing soon" under a minute', () => {
    expect(formatCountdown(inMs(30_000), NOW)).toBe('Closing soon');
  });

  it('reads "Closed" at or past the deadline', () => {
    expect(formatCountdown(inMs(0), NOW)).toBe('Closed');
    expect(formatCountdown(inMs(-HOUR), NOW)).toBe('Closed');
  });
});
