import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse, HealthStatus } from '@bulk/shared';
import { fetchHealth } from './health';

/**
 * Preserves the intent of the original App health test: the frontend can talk
 * to the backend /health endpoint and parse the standard success envelope.
 */
describe('fetchHealth', () => {
  beforeEach(() => {
    const envelope: ApiResponse<HealthStatus> = {
      success: true,
      data: { status: 'ok', service: 'backend', timestamp: new Date().toISOString() },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(envelope) }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the health payload from the success envelope', async () => {
    const health = await fetchHealth();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('backend');
  });

  it('throws when the envelope reports failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false, error: { code: 'X', message: 'nope' } }),
      }),
    );
    await expect(fetchHealth()).rejects.toThrow('nope');
  });
});
