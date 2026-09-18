/**
 * Test stub for `virtual:pwa-register/react`, the module `vite-plugin-pwa`
 * synthesises at build time (FEAT-008 / ADR-0015). Vitest cannot resolve a
 * virtual module, so `vite.config.ts` aliases it here under test.
 *
 * Tests drive the hook through `setMockRegisterSW`; `updateServiceWorker` is a
 * plain recording function so a test can assert the reload was requested.
 */
export interface RegisterSWState {
  needRefresh: boolean;
  offlineReady: boolean;
}

type UpdateFn = (reloadPage?: boolean) => Promise<void>;

const defaultState: RegisterSWState = { needRefresh: false, offlineReady: false };

let state: RegisterSWState = { ...defaultState };
export const updateServiceWorkerCalls: (boolean | undefined)[] = [];

/** Set what `useRegisterSW` reports. Call inside a test before rendering. */
export function setMockRegisterSW(next: Partial<RegisterSWState>): void {
  state = { ...defaultState, ...next };
}

/** Reset stub state + recorded calls between tests. */
export function resetMockRegisterSW(): void {
  state = { ...defaultState };
  updateServiceWorkerCalls.length = 0;
}

const updateServiceWorker: UpdateFn = async (reloadPage) => {
  updateServiceWorkerCalls.push(reloadPage);
};

export function useRegisterSW(): {
  needRefresh: [boolean, (value: boolean) => void];
  offlineReady: [boolean, (value: boolean) => void];
  updateServiceWorker: UpdateFn;
} {
  return {
    needRefresh: [state.needRefresh, (value: boolean) => setMockRegisterSW({ needRefresh: value })],
    offlineReady: [state.offlineReady, (value: boolean) => setMockRegisterSW({ offlineReady: value })],
    updateServiceWorker,
  };
}
