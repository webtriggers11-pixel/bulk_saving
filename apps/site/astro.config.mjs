// FEAT-028 (ADR-0039): a static one-page product site. No framework integration — Astro
// components plus vanilla TypeScript islands. `site` is a placeholder until the owner picks a
// domain; it only feeds canonical/OG URLs.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bulksaving.example',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  vite: {
    // The Three.js chunk (building.ts) is ~540 kB minified; it loads lazily after the page is
    // interactive (hero.ts), so the default 500 kB warning is noise here. The page itself is
    // ~7 kB of JS. Logged with FEAT-028 T4.
    build: { chunkSizeWarningLimit: 600 },
    // `three` is reached only through a dynamic import (hero.ts), so the dev server would
    // discover it on first use, re-optimise, and answer the first request with 504 "outdated
    // optimize dep" — the canvas never mounted on a cold dev server (FEAT-028 T5). Pre-bundle.
    optimizeDeps: { include: ['three'] },
  },
  devToolbar: { enabled: false },
  server: { port: 4321 },
});
