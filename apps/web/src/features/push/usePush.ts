import { useCallback, useEffect, useState } from 'react';
import { useAppearance } from '../../lib/appearance';
import { disablePush, enablePush, readPushState, type PushState } from '../../lib/push';

/**
 * This device's push state, plus the two actions (FEAT-020). `busy` while a permission
 * prompt or a request is in flight, so a control cannot be double-tapped into two
 * subscriptions. A failed request leaves the state as the browser reports it.
 */
export function usePush() {
  const { palette } = useAppearance();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void readPushState().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<PushState>) => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await action());
    } catch {
      setFailed(true);
      setState(await readPushState());
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    state,
    busy,
    failed,
    enable: () => run(() => enablePush(palette)),
    disable: () => run(disablePush),
  };
}
