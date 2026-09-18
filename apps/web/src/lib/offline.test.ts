import { describe, expect, it } from 'vitest';
import {
  OFFLINE_QUEUED_TEXT,
  OFFLINE_WAITING_LABEL,
  anyPaused,
  hasRows,
  queryStalled,
} from './offline';

describe('queryStalled', () => {
  it('is true for a real error', () => {
    expect(queryStalled({ isError: true, fetchStatus: 'idle' })).toBe(true);
  });

  it('is true when the query is PAUSED — the offline case that has no error', () => {
    // This is the whole point of BUG-004: isError stays false offline.
    expect(queryStalled({ isError: false, fetchStatus: 'paused' })).toBe(true);
  });

  it('is false while fetching or idle', () => {
    expect(queryStalled({ isError: false, fetchStatus: 'fetching' })).toBe(false);
    expect(queryStalled({ isError: false, fetchStatus: 'idle' })).toBe(false);
  });
});

describe('hasRows', () => {
  it('is false for an empty list, unlike Boolean([])', () => {
    expect(Boolean([])).toBe(true); // the trap this exists to avoid
    expect(hasRows([])).toBe(false);
  });

  it('is false for undefined and true for a populated list', () => {
    expect(hasRows(undefined)).toBe(false);
    expect(hasRows([1])).toBe(true);
  });
});

describe('anyPaused', () => {
  it('is true if any mutation is waiting for a connection', () => {
    expect(anyPaused({ isPaused: false }, { isPaused: true })).toBe(true);
    expect(anyPaused({ isPaused: false }, { isPaused: false })).toBe(false);
    expect(anyPaused()).toBe(false);
  });
});

describe('copy', () => {
  it('promises reconnection rather than reporting a failure', () => {
    // A paused mutation genuinely resumes, so calling it an error would be a lie.
    expect(OFFLINE_QUEUED_TEXT).toContain('reconnect');
    expect(OFFLINE_QUEUED_TEXT.toLowerCase()).not.toContain('failed');
  });

  it('keeps the button label a wait, not an error', () => {
    expect(OFFLINE_WAITING_LABEL.toLowerCase()).toContain('connection');
    expect(OFFLINE_WAITING_LABEL.toLowerCase()).not.toContain('error');
  });
});
