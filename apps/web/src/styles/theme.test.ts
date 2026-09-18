import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The token contract (FEAT-011 AC2/AC3/AC5, ADR-0021).
 *
 * These assert the STYLESHEET, not a rendered pixel: jsdom applies no CSS, so a
 * render test could never catch a palette that forgets a variable. What matters is
 * that the three palettes are interchangeable — same names, different values — and
 * that the motion layer has an off switch.
 */
// Vitest serves `import.meta.url` over http in the jsdom environment, so resolve from cwd
// (always `apps/web`, per the workspace test script) instead.
const css = readFileSync(join(process.cwd(), 'src/styles/theme.css'), 'utf8');

/** The custom properties declared inside one selector's block. */
function tokensOf(selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  expect(start, `${selector} is not declared`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const block = css.slice(open + 1, close);
  const tokens = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

const PALETTES = ['teal', 'indigo', 'ember'] as const;

describe('design tokens', () => {
  it('declares the default palette on :root so an unset data-theme still renders', () => {
    expect(css).toMatch(/:root,\s*\[data-theme='teal'\]/);
  });

  it.each(PALETTES)('palette %s declares exactly the same token names as teal', (palette) => {
    const teal = [...tokensOf(":root,\n[data-theme='teal']").keys()].sort();
    const theirs = [...tokensOf(`[data-theme='${palette}']`).keys()].sort();
    expect(theirs).toEqual(teal);
  });

  it.each(['indigo', 'ember'] as const)('palette %s re-tints — no value is shared with teal', (palette) => {
    const teal = tokensOf(":root,\n[data-theme='teal']");
    const theirs = tokensOf(`[data-theme='${palette}']`);
    const identical = [...theirs].filter(([name, value]) => teal.get(name) === value);
    expect(identical).toEqual([]);
  });

  it('stores colours as space-separated RGB channels, so every utility gets an alpha variant', () => {
    const teal = tokensOf(":root,\n[data-theme='teal']");
    for (const [name, value] of teal) {
      expect(value, `${name} must be "R G B", not a hex or rgba()`).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });

  it('keeps state hues out of the palettes — red means error in every theme', () => {
    for (const palette of PALETTES) {
      const selector = palette === 'teal' ? ":root,\n[data-theme='teal']" : `[data-theme='${palette}']`;
      const tokens = tokensOf(selector);
      for (const stateToken of ['--state-red', '--state-green', '--state-amber', '--state-blue']) {
        expect(tokens.has(stateToken), `${palette} must not redefine ${stateToken}`).toBe(false);
      }
    }
    expect(css).toMatch(/--state-red:\s*163 35 24;/);
  });

  it('themes by attribute, never by class — a palette swap cannot change a layout', () => {
    expect(css).not.toMatch(/\.theme-(teal|indigo|ember)/);
    for (const palette of PALETTES) {
      expect(css).toContain(`[data-theme='${palette}']`);
    }
  });

  it('turns the whole motion layer off under prefers-reduced-motion (AC5)', () => {
    const query = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(query).toContain('animation-duration: 0.01ms !important');
    expect(query).toContain('transition-duration: 0.01ms !important');
    expect(query).toContain('animation-iteration-count: 1 !important');
  });

  it('every keyframes animation is reachable through a named utility class', () => {
    const declared = [...css.matchAll(/@keyframes ([a-z-]+)/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(8);
    for (const name of declared) {
      expect(css, `@keyframes ${name} is declared but never used`).toMatch(
        new RegExp(`animation:\\s*${name}\\b`),
      );
    }
  });
});
