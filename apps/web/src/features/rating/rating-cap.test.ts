import { MAX_RATING_COMMENT } from '@bulk/shared';
import { describe, expect, it } from 'vitest';
import { MAX_COMMENT } from './RateRound';

/**
 * Pins the client's comment cap to the server's (V2 P2).
 *
 * The web app cannot import this value in production code: `@bulk/shared` builds to
 * CommonJS, so Rollup cannot see its named exports and the Vite build fails — every
 * other web import from that package is type-only for exactly this reason. A test
 * can import it (Vitest bundles with esbuild), so the constants are pinned here
 * rather than shared by reference.
 */
describe('rating comment cap', () => {
  it('matches the server-side limit exactly', () => {
    expect(MAX_COMMENT).toBe(MAX_RATING_COMMENT);
  });

  it('is the 500 the DTO validates against', () => {
    expect(MAX_RATING_COMMENT).toBe(500);
  });
});
