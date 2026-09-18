import { describe, expect, it, beforeEach } from 'vitest';
import { resetMockRegisterSW, setMockRegisterSW, updateServiceWorkerCalls, useRegisterSW } from 'virtual:pwa-register/react';

/**
 * T1 guard: proves the `virtual:pwa-register/react` alias resolves under Vitest.
 * If this fails, every UpdatePrompt test fails for an unrelated reason.
 */
describe('virtual:pwa-register/react (test alias)', () => {
  beforeEach(() => {
    resetMockRegisterSW();
  });

  it('resolves to the stub and reports no waiting worker by default', () => {
    const { needRefresh } = useRegisterSW();
    expect(needRefresh[0]).toBe(false);
  });

  it('reports a waiting worker once the test sets one, and records reload requests', async () => {
    setMockRegisterSW({ needRefresh: true });
    const { needRefresh, updateServiceWorker } = useRegisterSW();

    expect(needRefresh[0]).toBe(true);
    await updateServiceWorker(true);
    expect(updateServiceWorkerCalls).toEqual([true]);
  });
});
