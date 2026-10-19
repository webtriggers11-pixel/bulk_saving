import type { Accent, PushConfigDto } from '@bulk/shared';
import { apiRequest } from './api';

/**
 * Web push on this device (FEAT-020, ADR-0032).
 *
 *  - `unsupported` — no service worker / Push API (an iPhone browser tab: iOS only allows
 *    push for an app added to the Home Screen).
 *  - `denied` — the person blocked notifications for this site; only browser settings undo it.
 *  - `unavailable` — this server has no VAPID keys, so push is switched off.
 *  - `off` / `on` — whether this device is subscribed.
 *
 * Permission is only ever asked from {@link enablePush}, which callers run from a tap.
 */
export type PushState = 'unsupported' | 'denied' | 'unavailable' | 'off' | 'on';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** The registered worker, or null if none becomes ready soon (dev without a SW, for one). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4_000));
  return Promise.race([ready, timeout]);
}

/** VAPID public keys are base64url; the Push API wants the raw bytes. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function readPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  return subscription && Notification.permission === 'granted' ? 'on' : 'off';
}

function toBody(subscription: PushSubscription, accent: Accent) {
  const json = subscription.toJSON();
  return { endpoint: json.endpoint ?? subscription.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' }, accent };
}

/** Ask (from a tap), subscribe this device, and register it with the server. */
export async function enablePush(accent: Accent): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';
  const { publicKey } = await apiRequest<PushConfigDto>('/push/vapid-public-key');
  if (!publicKey) return 'unavailable';
  const reg = await registration();
  if (!reg) return 'unsupported';
  const key = keyBytes(publicKey);
  let subscription = await reg.pushManager.getSubscription();
  // A subscription made under an OLD server key (keys rotated) can never be delivered to;
  // re-posting it would show "on" while every push failed (V2 P2). Replace it.
  if (subscription && !sameKey(subscription.options?.applicationServerKey ?? null, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await apiRequest('/push/subscriptions', { method: 'POST', body: toBody(subscription, accent) });
  return 'on';
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!current) return true; // the browser does not expose it: nothing to compare, keep it
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((byte, i) => byte === expected[i]);
}

/**
 * Signing out (V2 P2): this phone must stop receiving the signed-out resident's rounds —
 * a shared phone would otherwise show them to the next person. With `server`, the device
 * row is deleted too (needs the token, so call BEFORE clearing it); a forced sign-out
 * without a usable token only drops the browser side, and the server row is pruned on
 * its next push (410). Bounded and silent: signing out never waits on, or fails with, this.
 */
export async function releasePushOnSignOut({ server }: { server: boolean }): Promise<void> {
  const work = (async () => {
    try {
      if (!pushSupported()) return;
      const reg = await registration();
      const subscription = reg ? await reg.pushManager.getSubscription() : null;
      if (!subscription) return;
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      if (server) await apiRequest('/push/subscriptions', { method: 'DELETE', body: { endpoint } });
    } catch {
      // Offline, or the session already gone: the 410 path cleans the server row up.
    }
  })();
  let timer = 0;
  try {
    await Promise.race([work, new Promise((resolve) => (timer = window.setTimeout(resolve, 3_000)))]);
  } finally {
    window.clearTimeout(timer);
  }
}

/** Unsubscribe this device everywhere: the browser first, then the server. */
export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await apiRequest('/push/subscriptions', { method: 'DELETE', body: { endpoint } });
  }
  return pushSupported() ? 'off' : 'unsupported';
}

/**
 * The person picked another colour: re-register this device so its pushes arrive in it.
 * A no-op when the device is not subscribed. Never throws — a colour change must not fail
 * because the network did.
 */
export async function syncPushAccent(accent: Accent): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    const reg = await registration();
    const subscription = reg ? await reg.pushManager.getSubscription() : null;
    if (subscription) await apiRequest('/push/subscriptions', { method: 'POST', body: toBody(subscription, accent) });
  } catch {
    // The next subscribe or colour change will carry it.
  }
}
