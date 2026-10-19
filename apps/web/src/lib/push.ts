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
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await apiRequest('/push/subscriptions', { method: 'POST', body: toBody(subscription, accent) });
  return 'on';
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
