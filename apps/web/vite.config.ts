import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // BUG-019: the web now imports a RUNTIME value from @bulk/shared (`normalisePhone`), not
  // only types. The package builds to CommonJS and resolves through the workspace symlink
  // to packages/shared/dist — outside node_modules, which is all Vite's CommonJS
  // conversion covers by default — so without this its named exports are invisible to the
  // production build ("normalisePhone is not exported by …/dist/index.js").
  build: { commonjsOptions: { include: [/node_modules/, /packages\/shared/] } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'push-sw.js', 'push/*.png'],
      // FEAT-020 (ADR-0032): the push + notificationclick handlers, loaded into the
      // generated worker. Caching strategy unchanged (ADR-0015).
      workbox: { importScripts: ['push-sw.js'] },
      manifest: {
        name: 'Bulk Saving',
        short_name: 'BulkSaving',
        description: 'Group buying for residential societies',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    // FEAT-008: `virtual:pwa-register/react` is synthesised by vite-plugin-pwa at
    // BUILD time, so Vitest cannot resolve it. Point it at a stub the tests drive.
    alias: {
      'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/pwa-register.stub.ts', import.meta.url)),
    },
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    // BUG-002: generous limits so RTL flows don't time out when the dev machine
    // is CPU-saturated (these bound hangs; passing tests are unaffected).
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
