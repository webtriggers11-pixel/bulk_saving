import { afterEach, describe, expect, it, vi } from 'vitest';
import { settleWithin } from './useAdmin';

describe('settleWithin (CHORE-020 V2 P2-c)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves as soon as the refresh does', async () => {
    let done = false;
    await settleWithin(Promise.resolve(), 3_000).then(() => (done = true));
    expect(done).toBe(true);
  });

  it('resolves even if the refresh fails — the write already succeeded', async () => {
    await expect(settleWithin(Promise.reject(new Error('refetch failed')), 3_000)).resolves.toBeUndefined();
  });

  it('stops waiting after the limit when the refresh hangs (offline after the write)', async () => {
    vi.useFakeTimers();
    let done = false;
    void settleWithin(new Promise(() => {}), 3_000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
