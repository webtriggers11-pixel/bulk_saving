/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/**
 * Under Vitest this module is aliased to `src/test/pwa-register.stub.ts`
 * (see vite.config.ts), which adds the test-only controls below on top of the
 * plugin's own `useRegisterSW` typing.
 */
declare module 'virtual:pwa-register/react' {
  export function useRegisterSW(): {
    needRefresh: [boolean, (value: boolean) => void];
    offlineReady: [boolean, (value: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
  export function setMockRegisterSW(next: { needRefresh?: boolean; offlineReady?: boolean }): void;
  export function resetMockRegisterSW(): void;
  export const updateServiceWorkerCalls: (boolean | undefined)[];
  export const registerCalls: { count: number };
}
