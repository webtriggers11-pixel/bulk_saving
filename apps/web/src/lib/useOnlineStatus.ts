import { useEffect, useState } from 'react';

/**
 * Lives in `lib/`, not in a feature: `components/QueryState` needs it, and a shared
 * component that imports from `features/*` inverts the one dependency rule this
 * codebase enforces (ADR-0022). Browser state is not a feature.
 *
 * Whether the browser currently believes it has a network connection
 * (FEAT-008 / ADR-0015). `navigator.onLine` is the browser's own guess — it can
 * report true on a captive portal — so it drives PRESENTATION only (a banner),
 * never a decision about whether to attempt a request. A failed request still
 * shows its own error state.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Re-read on mount: the event may have fired before this component existed.
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
