import { createContext, useContext, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface ServiceWorkerState {
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const ServiceWorkerContext = createContext<ServiceWorkerState | null>(null);

/**
 * FEAT-029: the ONE service-worker registration, at the app root (main.tsx).
 *
 * It used to happen inside UpdatePrompt, which only the resident AppShell renders, so the
 * sign-in page and every /admin screen never registered the worker. A first-time visitor
 * offline got the browser's error page, and an admin never got the offline shell or push.
 * UpdatePrompt now reads this context instead of registering a second copy.
 */
export function ServiceWorkerProvider({ children }: { children: ReactNode }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  return (
    <ServiceWorkerContext.Provider value={{ needRefresh, updateServiceWorker }}>{children}</ServiceWorkerContext.Provider>
  );
}

/** The registration's state, or null outside the provider (a screen rendered on its own in a test). */
export function useServiceWorker(): ServiceWorkerState | null {
  return useContext(ServiceWorkerContext);
}
