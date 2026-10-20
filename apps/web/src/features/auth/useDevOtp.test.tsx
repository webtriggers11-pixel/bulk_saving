import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../lib/api';
import { useDevOtp } from './useDevOtp';

vi.mock('../../lib/api', () => ({ apiRequest: vi.fn() }));
const apiMock = vi.mocked(apiRequest);

/** FEAT-026 (ADR-0037): dev-build-only; retries briefly; silent on 404. */
describe('useDevOtp', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    apiMock.mockReset();
    vi.useRealTimers();
  });

  it('in a DEV build, asks the dev route for the canonical phone and exposes the code', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    apiMock.mockResolvedValue({ code: '123456' });
    const { result } = renderHook(() => useDevOtp());
    act(() => result.current.fetchFor('99999 00201'));
    await waitFor(() => expect(result.current.code).toBe('123456'));
    expect(apiMock).toHaveBeenCalledWith('/dev/otp?phone=%2B919999900201', { auth: false });
    act(() => result.current.clear());
    expect(result.current.code).toBeNull();
  });

  it('retries while the (queued) code is not stashed yet, then gives up quietly', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    vi.useFakeTimers();
    apiMock.mockRejectedValueOnce(new Error('404')).mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({ code: '777777' });
    const { result } = renderHook(() => useDevOtp());
    act(() => result.current.fetchFor('+919999900001'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_300);
    });
    expect(result.current.code).toBe('777777');
    expect(apiMock).toHaveBeenCalledTimes(3);

    apiMock.mockReset().mockRejectedValue(new Error('404'));
    act(() => result.current.clear());
    act(() => result.current.fetchFor('+919999900001'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(result.current.code).toBeNull();
    expect(apiMock).toHaveBeenCalledTimes(4);
  });

  it('a result that lands after clear() is dropped (an old number cannot reappear)', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    let release: (value: { code: string }) => void = () => undefined;
    apiMock.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const { result } = renderHook(() => useDevOtp());
    act(() => result.current.fetchFor('+919999900001'));
    act(() => result.current.clear());
    await act(async () => {
      release({ code: '111111' });
      await Promise.resolve();
    });
    expect(result.current.code).toBeNull();
  });

  it('outside a DEV build it never calls anything', () => {
    vi.stubEnv('DEV', false);
    const { result } = renderHook(() => useDevOtp());
    act(() => result.current.fetchFor('+919999900001'));
    expect(apiMock).not.toHaveBeenCalled();
    expect(result.current.code).toBeNull();
  });
});
