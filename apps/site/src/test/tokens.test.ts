/**
 * AC2 / ADR-0039 §2: the site's tokens ARE the app's tokens. Every (selector, declaration) in
 * tokens.css must appear, with the same value, in apps/web/src/styles/theme.css; the accent
 * blocks must be complete; and the pairs the page relies on must meet WCAG contrast in both
 * schemes (AC6).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { channels, contrast, parseBlocks } from './css';

const here = fileURLToPath(new URL('.', import.meta.url));
const site = parseBlocks(readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8'));
const web = parseBlocks(readFileSync(`${here}/../../../web/src/styles/theme.css`, 'utf8'));

const ACCENTS = ['mono', 'ocean', 'aurora', 'bloom', 'sunset', 'forest', 'lagoon'];
const PAIR = ['--brand', '--brand-2', '--brand-deep', '--brand-light', '--brand-ink'];

describe('tokens.css mirrors apps/web theme.css', () => {
  it('every declaration in the site exists in the app with the same value', () => {
    const drift: string[] = [];
    for (const [selector, blocks] of site) {
      const theirs = web.get(selector);
      if (!theirs) {
        drift.push(`${selector}: selector not in the app's theme`);
        continue;
      }
      for (const block of blocks) {
        for (const [prop, value] of block) {
          const ok = theirs.some((t) => t.get(prop) === value);
          if (!ok) drift.push(`${selector} { ${prop}: ${value} } ≠ app (${theirs.map((t) => t.get(prop)).join(' | ')})`);
        }
      }
    }
    expect(drift).toEqual([]);
  });

  it('declares all seven accent pairs, day and night, completely', () => {
    for (const a of ACCENTS) {
      for (const sel of [`[data-accent='${a}']`, `html[data-scheme='dark'][data-accent='${a}']`]) {
        const block = site.get(sel)?.[0];
        expect(block, sel).toBeDefined();
        for (const p of PAIR) expect(block?.get(p), `${sel} ${p}`).toMatch(/^\d+ \d+ \d+$/);
      }
    }
  });

  it('declares the Vercel geometry and type', () => {
    const look = site.get(`html[data-look='vercel']`)?.[0];
    expect(look?.get('--radius-card')).toBe('12px');
    expect(look?.get('--font-sans')).toContain('Geist');
    expect(look?.get('--font-label')).toContain('Geist Mono');
  });
});

describe('contrast in both schemes (AC6)', () => {
  const mono = site.get(`[data-theme='mono']`)![0]!;
  const root = site.get(':root')![0]!;
  const night = site.get(`html[data-scheme='dark'][data-theme='mono']`)![0]!;
  const day = { ink: mono.get('--ink')!, muted: mono.get('--ink-muted')!, soft: mono.get('--ink-soft')!, ground: mono.get('--ground')!, paper: root.get('--paper')!, onFill: root.get('--on-fill')! };
  const dark = { ink: night.get('--ink')!, muted: night.get('--ink-muted')!, soft: night.get('--ink-soft')!, ground: night.get('--ground')!, paper: night.get('--paper')!, onFill: night.get('--on-fill')! };

  for (const [name, s] of [['day', day], ['night', dark]] as const) {
    it(`${name}: ink, muted and soft ink read on ground and paper`, () => {
      for (const fg of [s.ink, s.muted, s.soft]) {
        for (const bg of [s.ground, s.paper]) {
          expect(contrast(channels(fg), channels(bg))).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`${name}: on-fill text reads on every accent's brand and brand-deep; brand-ink reads on ground and paper`, () => {
      for (const a of ACCENTS) {
        const sel = name === 'day' ? `[data-accent='${a}']` : `html[data-scheme='dark'][data-accent='${a}']`;
        const b = site.get(sel)![0]!;
        for (const fill of [b.get('--brand')!, b.get('--brand-deep')!]) {
          expect(contrast(channels(s.onFill), channels(fill)), `${a} ${name} on-fill on ${fill}`).toBeGreaterThanOrEqual(4.5);
        }
        for (const bg of [s.ground, s.paper]) {
          expect(contrast(channels(b.get('--brand-ink')!), channels(bg)), `${a} ${name} brand-ink on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});

describe('site.css never invents a colour (DESIGN-SYSTEM.md)', () => {
  const css = readFileSync(new URL('../styles/site.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  it('has no hex colours, named colours or literal rgb() outside tokens', () => {
    // `#000` inside a mask-image gradient is a mask alpha, not a colour (the app does the same).
    const stripped = css.replace(/mask-image:[^;]+;/g, '');
    expect(stripped.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    // a colour KEYWORD, not `white-space` or `--state-green`
    expect(stripped.match(/(?<![-\w])(white|black|red|blue|green|gray|grey)(?![-\w])/g) ?? []).toEqual([]);
    expect(stripped.match(/rgba?\(\s*\d/g) ?? []).toEqual([]);
  });
});
