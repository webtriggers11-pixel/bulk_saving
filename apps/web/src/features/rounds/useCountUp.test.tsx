import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCountUp } from './useCountUp';

describe('useCountUp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the true number immediately when motion preference cannot be read', () => {
    // jsdom has no matchMedia: the honest answer is "do not animate", which is
    // also what keeps every rounds test deterministic.
    const { result } = renderHook(() => useCountUp(18));
    expect(result.current).toBe(18);
  });

  it('shows the true number immediately when the viewer asked for reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const { result } = renderHook(() => useCountUp(32));
    expect(result.current).toBe(32);
  });

  it('starts from zero only when motion is welcome', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const { result } = renderHook(() => useCountUp(40));
    expect(result.current).toBe(0);
  });
});
