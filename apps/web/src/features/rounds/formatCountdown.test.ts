import { describe, expect, it } from 'vitest';
import { formatClosingDate, formatCountdown } from './formatCountdown';

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

describe('formatClosingDate (FEAT-040)', () => {
  // Local-time dates, so the test holds in any time zone.
  const now = new Date(2026, 10, 23, 10, 0); // Mon 23 Nov 2026, 10:00
  it.each([
    [new Date(2026, 10, 23, 18, 30), 'Today, 6:30 pm'],
    [new Date(2026, 10, 24, 9, 5), 'Tomorrow, 9:05 am'],
    [new Date(2026, 10, 26, 18, 30), 'Thu 26 Nov, 6:30 pm'],
    [new Date(2027, 0, 4, 12, 0), 'Mon 4 Jan 2027, 12:00 pm'],
  ])('%s → %s', (date, label) => {
    expect(formatClosingDate(date.toISOString(), now)).toBe(label);
  });
  it('is empty for a bad date', () => {
    expect(formatClosingDate('nope', now)).toBe('');
  });
});
