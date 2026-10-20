/**
 * BUG-023: the catalog Flip must not collapse the wall. Vitest runs in node with no layout
 * engine, so this pins the source the way catalog.seed.test.ts pins the seed: only leavers
 * may go absolute, the wall's height is held through the tween, and the wall is positioned
 * with leavers stacked underneath the movers.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./catalog.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/site.css', import.meta.url), 'utf8');
const rule = (sel: string) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.>*]/g, (m) => `\\${m}`)}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('catalog Flip keeps the wall in flow (BUG-023)', () => {
  it('only the leaving cards leave the flow', () => {
    expect(src).not.toMatch(/absolute:\s*true/);
    expect(src).toMatch(/absoluteOnLeave:\s*true/);
  });
  it('the wall tweens its height from the old layout to the new one', () => {
    expect(src).toMatch(/fromTo\(wall,\s*\{\s*height:\s*h0\s*\},\s*\{\s*height:\s*h1/);
    expect(src).toMatch(/clearProps:\s*'height'/);
  });
  it('the wall is positioned and leavers stack under the movers', () => {
    expect(rule('.wall')).toMatch(/position:\s*relative/);
    expect(rule('.wall > .svc')).toMatch(/z-index:\s*1/);
    // Same specificity as the rule above and later in the sheet, or the cascade keeps z-index 1.
    expect(rule('.wall > .svc--leaving')).toMatch(/z-index:\s*0/);
    expect(css.indexOf('.wall > .svc--leaving')).toBeGreaterThan(css.indexOf('.wall > .svc {'));
    expect(src).toMatch(/svc--leaving/);
  });
  it('the old height is read before getState (which ends a running Flip and its height tween)', () => {
    expect(src.indexOf('const h0 = wall.offsetHeight')).toBeLessThan(src.indexOf('Flip.getState(cards)'));
  });
});
