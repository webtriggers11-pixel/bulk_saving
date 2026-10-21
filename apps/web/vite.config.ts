import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { MANIFEST } from './src/pwa/manifest';
import { REGISTER_TYPE, RUNTIME_CACHING } from './src/pwa/config';

export default defineConfig({
  // BUG-019: the web now imports a RUNTIME value from @bulk/shared (`normalisePhone`), not
  // only types. The package builds to CommonJS and resolves through the workspace symlink
  // to packages/shared/dist — outside node_modules, which is all Vite's CommonJS
  // conversion covers by default — so without this its named exports are invisible to the
  // production build ("normalisePhone is not exported by …/dist/index.js").
  build: { commonjsOptions: { include: [/node_modules/, /packages\/shared/] } },
  // …and the DEV server does not go through Rollup at all: a linked dependency outside
  // node_modules is served raw, so the browser got CommonJS and threw "does not provide an
  // export named normalisePhone" (V2 P1). esbuild pre-bundling gives it CJS interop.
  optimizeDeps: { include: ['@bulk/shared'] },
  plugins: [
    react(),
    VitePWA({
      registerType: REGISTER_TYPE,
      includeAssets: [
        'favicon.svg',
        'favicon.png',
        'favicon-32.png',
        'apple-touch-icon.png',
        'push-sw.js',
        'push/*.png',
        'shortcuts/*.png',
        // Not precached: splash/ (iOS reads it once, at Add to Home Screen) and
        // screenshots/ (only the browser's install sheet uses it).
      ],
      workbox: {
        // FEAT-020 (ADR-0032): the push + notificationclick handlers, loaded into the
        // generated worker.
        importScripts: ['push-sw.js'],
        // FEAT-029 (ADR-0041): Google Fonts only; the rules live in src/pwa/config.ts.
        runtimeCaching: RUNTIME_CACHING,
      },
      // FEAT-029: the manifest lives in src/pwa/manifest.ts, where pwa.test.ts reads it.
      manifest: MANIFEST,
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
