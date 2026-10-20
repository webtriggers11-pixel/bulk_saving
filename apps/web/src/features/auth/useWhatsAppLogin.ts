import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResult, WaStartResponse, WaStatusResponse } from '@bulk/shared';
import { queryStalled } from '../../lib/offline';
import { fetchWhatsAppStatus } from './wa.api';

/** How often the browser asks whether the tap happened. */
export const WA_POLL_MS = 2_000;

export type WaView =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'pending' | 'awaiting_confirm'; session: WaStartResponse }
  | { phase: 'denied'; session: WaStartResponse; reason: 'WRONG_NUMBER' | 'NOT_AN_ADMIN' }
  | { phase: 'expired'; session: WaStartResponse };

function terminal(data: WaStatusResponse | undefined): boolean {
  return data !== undefined && data.status !== 'pending' && data.status !== 'awaiting_confirm';
}

/**
 * One WhatsApp sign-in from the browser's side (FEAT-027, ADR-0038): start it, poll its
 * status every {@link WA_POLL_MS} until it is decided, hand the tokens over exactly once.
 * The `requestId` lives only in this hook's state and in the query cache, which is
 * emptied of it the moment the session is established.
 */
export function useWhatsAppLogin(start: () => Promise<WaStartResponse>, onSignedIn: (result: AuthResult) => void, pollMs: number = WA_POLL_MS) {
  const client = useQueryClient();
  const startMutation = useMutation({ mutationFn: start });
  const session = startMutation.data ?? null;
  const requestId = session?.requestId ?? null;
  // Set the moment the tokens are handed over, so the observer stops before the page
  // unmounts — otherwise a re-render between sign-in and navigation rebuilt the query and
  // asked once more (V2 P3).
  const [handedOver, setHandedOver] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['auth', 'wa', 'status', requestId],
    queryFn: () => fetchWhatsAppStatus(requestId as string),
    enabled: requestId !== null && handedOver !== requestId,
    retry: false,
    refetchInterval: (query) => (terminal(query.state.data) ? false : pollMs),
    refetchIntervalInBackground: true,
  });

  // The tokens pass through once. A ref, not state: the query keeps the confirmed payload
  // until the key is dropped, and a re-render must not sign in twice.
  const handed = useRef<string | null>(null);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;
  const data = statusQuery.data;
  useEffect(() => {
    if (!requestId || !data || data.status !== 'confirmed' || handed.current === requestId) return;
    handed.current = requestId;
    setHandedOver(requestId);
    const { status: _status, ...result } = data;
    void _status;
    client.removeQueries({ queryKey: ['auth', 'wa'] });
    onSignedInRef.current(result);
  }, [client, data, requestId]);

  const expiredByClock = session !== null && !terminal(data) && Date.parse(session.expiresAt) < Date.now() && data?.status !== undefined;

  let view: WaView;
  if (startMutation.isPending) view = { phase: 'starting' };
  else if (!session) view = { phase: 'idle' };
  else if (data?.status === 'denied') view = { phase: 'denied', session, reason: data.reason };
  else if (data?.status === 'expired' || expiredByClock) view = { phase: 'expired', session };
  else view = { phase: data?.status === 'awaiting_confirm' ? 'awaiting_confirm' : 'pending', session };

  return {
    view,
    start: () => startMutation.mutate(),
    reset: () => {
      client.removeQueries({ queryKey: ['auth', 'wa'] });
      setHandedOver(null);
      startMutation.reset();
    },
    startError: startMutation.isError ? startMutation.error : null,
    queuedOffline: startMutation.isPaused,
    /** The polling cannot reach the server (offline, or it is failing). */
    stalled: requestId !== null && queryStalled(statusQuery),
  };
}
