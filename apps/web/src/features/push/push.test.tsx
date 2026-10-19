import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../lib/api';
import { disablePush, enablePush, keyBytes, readPushState, syncPushAccent } from '../../lib/push';

/**
 * FEAT-020 (ADR-0032) — web push on the device: the lib, the service-worker handlers,
 * the Profile switch and the contextual prompt.
 */
vi.mock('../../lib/api', () => ({ apiRequest: vi.fn() }));
const api = vi.mocked(apiRequest);

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/device-1';

function installPush(opts: { permission?: NotificationPermission; ask?: NotificationPermission; subscribed?: boolean } = {}) {
  let current = opts.subscribed
    ? { endpoint: ENDPOINT, toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn().mockResolvedValue(true) }
    : null;
  const subscribe = vi.fn(async () => {
    current = { endpoint: ENDPOINT, toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn().mockResolvedValue(true) };
    return current;
  });
  const registration = { pushManager: { getSubscription: vi.fn(async () => current), subscribe } };
  const Notification = { permission: opts.permission ?? 'default', requestPermission: vi.fn(async () => opts.ask ?? 'granted') };
  vi.stubGlobal('Notification', Notification);
  vi.stubGlobal('PushManager', function PushManager() {});
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration) } });
  return { registration, subscribe, Notification, current: () => current };
}

beforeEach(() => {
  api.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error — test cleanup of the stubbed worker container
  delete navigator.serviceWorker;
  localStorage.clear();
});

describe('lib/push', () => {
  it('reports unsupported where there is no Push API (an iPhone browser tab)', async () => {
    expect(await readPushState()).toBe('unsupported');
  });

  it('reports a blocked site as denied, without asking again', async () => {
    const env = installPush({ permission: 'denied' });
    expect(await readPushState()).toBe('denied');
    expect(env.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('enable: asks, subscribes with the server key, and registers the device in its accent', async () => {
    const env = installPush();
    api.mockResolvedValueOnce({ publicKey: 'AQID' }).mockResolvedValueOnce({ subscribed: true });
    expect(await enablePush('sunset')).toBe('on');
    expect(env.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2, 3]) });
    expect(api).toHaveBeenLastCalledWith('/push/subscriptions', {
      method: 'POST',
      body: { endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' }, accent: 'sunset' },
    });
  });

  it('enable on a server without push keys says so and subscribes nothing', async () => {
    const env = installPush();
    api.mockResolvedValueOnce({ publicKey: null });
    expect(await enablePush('mono')).toBe('unavailable');
    expect(env.subscribe).not.toHaveBeenCalled();
  });

  it('a person who says no is left alone', async () => {
    const env = installPush({ ask: 'denied' });
    expect(await enablePush('mono')).toBe('denied');
    expect(env.subscribe).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it('disable: unsubscribes in the browser, then forgets the device on the server', async () => {
    const env = installPush({ permission: 'granted', subscribed: true });
    const sub = env.current()!;
    api.mockResolvedValueOnce({ subscribed: false });
    expect(await disablePush()).toBe('off');
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith('/push/subscriptions', { method: 'DELETE', body: { endpoint: ENDPOINT } });
  });

  it('a colour change re-registers a subscribed device — and never throws', async () => {
    installPush({ permission: 'granted', subscribed: true });
    api.mockRejectedValueOnce(new Error('offline'));
    await expect(syncPushAccent('aurora')).resolves.toBeUndefined();
    expect(api).toHaveBeenCalledWith('/push/subscriptions', expect.objectContaining({ body: expect.objectContaining({ accent: 'aurora' }) }));
  });

  it('decodes a base64url VAPID key to bytes', () => {
    expect(keyBytes('-_8')).toEqual(new Uint8Array([251, 255]));
  });
});

describe('push-sw.js (the service-worker handlers)', () => {
  function loadWorker() {
    const source = readFileSync(join(process.cwd(), 'public/push-sw.js'), 'utf8');
    const listeners: Record<string, (e: unknown) => void> = {};
    const focused = { url: 'http://localhost/', focus: vi.fn(), navigate: vi.fn() };
    focused.focus.mockResolvedValue(focused);
    const scope = {
      location: { origin: 'http://localhost' },
      registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
      clients: { matchAll: vi.fn().mockResolvedValue([] as unknown[]), openWindow: vi.fn() },
      addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
      __bulkPush: undefined as unknown,
    };
    new Function('self', source)(scope);
    return { scope, listeners, focused };
  }
  const pushEvent = (data: unknown) => {
    const waits: Promise<unknown>[] = [];
    return { event: { data: { json: () => data, text: () => '' }, waitUntil: (p: Promise<unknown>) => waits.push(p) }, waits };
  };

  it('shows the event in the payload accent, tagged per round', async () => {
    const { scope, listeners } = loadWorker();
    const { event, waits } = pushEvent({ title: 'It’s going ahead', body: 'AC Servicing', url: '/my-requests', tag: 'round:r1', accent: 'aurora' });
    listeners.push(event);
    await Promise.all(waits);
    expect(scope.registration.showNotification).toHaveBeenCalledWith('It’s going ahead', expect.objectContaining({
      body: 'AC Servicing',
      icon: '/push/icon-aurora.png',
      badge: '/push/badge.png',
      tag: 'round:r1',
      data: { url: '/my-requests' },
    }));
  });

  it('an unknown accent falls back to Mono, and an off-site link to the home screen', async () => {
    const { scope, listeners } = loadWorker();
    const { event, waits } = pushEvent({ title: 'x', accent: 'neon', url: 'https://evil.example/phish' });
    listeners.push(event);
    await Promise.all(waits);
    expect(scope.registration.showNotification).toHaveBeenCalledWith('x', expect.objectContaining({ icon: '/push/icon-mono.png', data: { url: '/' } }));
  });

  it('a tap focuses an open window and takes it to the page — or opens one', async () => {
    const { scope, listeners, focused } = loadWorker();
    const close = vi.fn();
    let waits: Promise<unknown>[] = [];
    listeners.notificationclick({ notification: { close, data: { url: '/rounds' } }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(close).toHaveBeenCalled();
    expect(scope.clients.openWindow).toHaveBeenCalledWith('/rounds');

    scope.clients.matchAll.mockResolvedValue([focused]);
    waits = [];
    listeners.notificationclick({ notification: { close, data: { url: '/my-requests' } }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(focused.focus).toHaveBeenCalled();
    expect(focused.navigate).toHaveBeenCalledWith('/my-requests');
  });
});

describe('Profile → Notifications and the rounds prompt', () => {
  it('the switch turns notifications on for this phone', async () => {
    const env = installPush();
    api.mockResolvedValueOnce({ publicKey: 'AQID' }).mockResolvedValueOnce({ subscribed: true });
    const { NotificationsRow } = await import('./NotificationsRow');
    render(<NotificationsRow />);
    const toggle = await screen.findByRole('switch', { name: 'Notifications on this phone' });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(env.subscribe).toHaveBeenCalled();
    expect(screen.getByTestId('notifications-line')).toHaveTextContent('On for this phone');
  });

  it('where push cannot work, the switch is off and says why', async () => {
    const { NotificationsRow } = await import('./NotificationsRow');
    render(<NotificationsRow />);
    await waitFor(() => expect(screen.getByTestId('notifications-line')).toHaveTextContent('Home Screen'));
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('the prompt appears only after a join, and "Not now" is remembered', async () => {
    installPush();
    const { PushPrompt } = await import('./PushPrompt');
    const { rerender, unmount } = render(<PushPrompt joinedAny={false} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('push-prompt')).not.toBeInTheDocument();
    rerender(<PushPrompt joinedAny />);
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('push-prompt')).not.toBeInTheDocument();
    unmount();
    render(<PushPrompt joinedAny />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('push-prompt')).not.toBeInTheDocument();
  });
});
