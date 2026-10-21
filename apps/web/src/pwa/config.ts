/**
 * The service-worker settings vite.config.ts hands to vite-plugin-pwa, kept here so
 * pwa.test.ts exercises the values the build uses (FEAT-029 V2 P2, BUG-025).
 */
import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * BUG-025: 'prompt', never 'autoUpdate'. autoUpdate builds the worker with skipWaiting +
 * clientsClaim and reloads the page when it activates, so `needRefresh` never fired and a
 * half-filled pledge, OTP or admin form was lost on every deploy. With 'prompt' a new build
 * waits: UpdatePrompt's Reload activates it (resident shell and admin layout); otherwise it
 * takes over once every window of the app is closed. Reload in one tab also reloads the
 * other open tabs of the app (the plugin's `controlling` listener).
 */
export const REGISTER_TYPE: VitePWAOptions['registerType'] = 'prompt';

type RuntimeCaching = NonNullable<NonNullable<VitePWAOptions['workbox']>['runtimeCaching']>;

/**
 * FEAT-029 (ADR-0041, amends ADR-0015's scope): Google Fonts only, so an installed app
 * opened offline keeps its typeface. No API response is cached; pwa.test.ts calls each
 * rule with API URLs to prove it.
 */
export const RUNTIME_CACHING: RuntimeCaching = [
  {
    urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'google-fonts-css' },
  },
  {
    urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
    handler: 'CacheFirst',
    options: {
      cacheName: 'google-fonts-files',
      expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
];
