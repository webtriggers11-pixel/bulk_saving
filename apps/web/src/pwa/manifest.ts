/**
 * FEAT-029 (ADR-0041): the web app manifest. vite.config.ts hands this object to
 * vite-plugin-pwa, and pwa.test.ts reads the same object, so what is tested is what ships.
 * Plain data: this file is compiled by both the app and the node (vite config) programs.
 */
import type { ManifestOptions } from 'vite-plugin-pwa';

/** The Mono light ground (theme.css `--ground`, index.html GROUND); pwa.test.ts pins it. */
export const GROUND_LIGHT = '#fafafa';

export const MANIFEST = {
  id: '/',
  name: 'Bulk Saving',
  short_name: 'Bulk Saving',
  description: 'Group buying for your residential society: pool with neighbours, unlock a cheaper price together.',
  lang: 'en-IN',
  dir: 'ltr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: GROUND_LIGHT,
  background_color: GROUND_LIGHT,
  categories: ['shopping', 'lifestyle', 'utilities'],
  prefer_related_applications: false,
  // A second launch focuses the open window and navigates it, rather than opening another.
  launch_handler: { client_mode: 'navigate-existing' },
  icons: [
    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/pwa-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    {
      name: 'Group buys',
      short_name: 'Group buys',
      description: 'Open rounds in your society',
      url: '/rounds',
      icons: [{ src: '/shortcuts/rounds.png', sizes: '96x96', type: 'image/png' }],
    },
    {
      name: 'Services',
      short_name: 'Services',
      description: 'Browse services and ask for one',
      url: '/services',
      icons: [{ src: '/shortcuts/services.png', sizes: '96x96', type: 'image/png' }],
    },
    {
      name: 'My requests',
      short_name: 'Requests',
      description: 'Your pledges and asks',
      url: '/my-requests',
      icons: [{ src: '/shortcuts/requests.png', sizes: '96x96', type: 'image/png' }],
    },
  ],
  // Chrome's richer install sheet. Captured from the real app (seeded demo data) at FEAT-029.
  screenshots: [
    {
      src: '/screenshots/home-narrow.png',
      sizes: '1080x1920',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Home: the group buys open in your society',
    },
    {
      src: '/screenshots/rounds-narrow.png',
      sizes: '1080x1920',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Group buys: join a round and watch the price drop',
    },
    {
      src: '/screenshots/home-wide.png',
      sizes: '1920x1200',
      type: 'image/png',
      form_factor: 'wide',
      label: 'Bulk Saving on a larger screen',
    },
  ],
} satisfies Partial<ManifestOptions>;
