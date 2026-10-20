import { getViteConfig } from 'astro/config';
import { defineConfig } from 'vitest/config';

// `getViteConfig` lets Vitest import `.astro` components through Astro's own Vite plugins, so
// the page test renders the real page with `experimental_AstroContainer` (ADR-0038 §3). The
// `test` block is typed by Vitest's `defineConfig`; Astro's helper only sees Vite's shape.
const config = defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
});

export default getViteConfig(config);
