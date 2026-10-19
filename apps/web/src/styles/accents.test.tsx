import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Sparkles } from '../components/ui/sparkles';
import { PALETTES } from '../lib/appearance';

/**
 * FEAT-019 (ADR-0031) — one Vercel look, seven accent pairs, and the micro-interactions.
 */
const css = readFileSync(join(process.cwd(), 'src/styles/theme.css'), 'utf8');

type RGB = [number, number, number];
function block(selector: string): Record<string, RGB> {
  const start = css.indexOf(selector);
  expect(start, `${selector} is not declared`).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const out: Record<string, RGB> = {};
  for (const [, name, value] of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(\d+ \d+ \d+);/g)) {
    out[name] = value.split(' ').map(Number) as RGB;
  }
  return out;
}
const lum = ([r, g, b]: RGB) =>
  [r, g, b]
    .map((c) => c / 255)
    .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const DAY: Record<string, RGB> = { ...block("[data-theme='mono'] {"), '--paper': [255, 255, 255], '--on-fill': [255, 255, 255] };
const NIGHT = block("html[data-scheme='dark'][data-theme='mono'] {");
const PAIR = ['--brand', '--brand-2', '--brand-deep', '--brand-light', '--brand-ink'];

describe('accents — seven pairs over the neutral Vercel base (AC2)', () => {
  it('offers exactly the seven accents the stylesheet declares, Mono first', () => {
    expect(PALETTES).toEqual(['mono', 'ocean', 'aurora', 'bloom', 'sunset', 'forest', 'lagoon']);
  });

  it.each(PALETTES)('%s declares the whole pair by day and by night', (accent) => {
    expect(Object.keys(block(`[data-accent='${accent}'] {`)).sort()).toEqual([...PAIR].sort());
    expect(Object.keys(block(`html[data-scheme='dark'][data-accent='${accent}'] {`)).sort()).toEqual([...PAIR].sort());
  });

  it.each(PALETTES)('%s: accent ink clears 4.5:1 on ground and paper, day and night', (accent) => {
    const day = block(`[data-accent='${accent}'] {`);
    const night = block(`html[data-scheme='dark'][data-accent='${accent}'] {`);
    expect(ratio(day['--brand-ink'], DAY['--ground'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(day['--brand-ink'], DAY['--paper'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(night['--brand-ink'], NIGHT['--ground'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(night['--brand-ink'], NIGHT['--paper'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETTES)('%s: fill text clears 4.5:1 on brand and brand-deep, day and night', (accent) => {
    const day = block(`[data-accent='${accent}'] {`);
    const night = block(`html[data-scheme='dark'][data-accent='${accent}'] {`);
    for (const fill of ['--brand', '--brand-deep'] as const) {
      expect(ratio(DAY['--on-fill'], day[fill]), `day ${fill}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(NIGHT['--on-fill'], night[fill]), `night ${fill}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('accent blocks come after the neutral base, so they win at equal specificity', () => {
    expect(css.indexOf("[data-accent='mono'] {")).toBeGreaterThan(css.indexOf("[data-theme='mono'] {"));
    expect(css.indexOf("html[data-scheme='dark'][data-accent='mono'] {")).toBeGreaterThan(
      css.indexOf("html[data-scheme='dark'][data-theme='mono'] {"),
    );
  });

  it('the look is keyed on data-look, never on a palette', () => {
    const look = css.slice(css.indexOf('/* ---- The Vercel look'), css.indexOf('/**\n * AC5: one switch'));
    expect(look).not.toMatch(/html\[data-theme='mono'\] \./);
    expect(look).toMatch(/html\[data-look='vercel'\] \.surface-glass/);
  });
});

describe('micro-interactions (AC5, AC6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const motion = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }));

  it('an interactive card tracks the mouse for the spotlight, and ignores touch', () => {
    // jsdom has no PointerEvent, so `pointerType` would be dropped; give it one.
    class FakePointerEvent extends MouseEvent {
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerType = init.pointerType ?? '';
      }
    }
    vi.stubGlobal('PointerEvent', FakePointerEvent);
    render(<Card data-testid="card">x</Card>);
    const card = screen.getByTestId('card');
    fireEvent.pointerMove(card, { pointerType: 'touch', clientX: 30, clientY: 40 });
    expect(card.style.getPropertyValue('--mx')).toBe('');
    fireEvent.pointerMove(card, { pointerType: 'mouse', clientX: 30, clientY: 40 });
    expect(card.style.getPropertyValue('--mx')).toBe('30px');
    expect(card.style.getPropertyValue('--my')).toBe('40px');
  });

  it('a card keeps its own pointer handler', () => {
    const own = vi.fn();
    render(<Card data-testid="card" onPointerMove={own}>x</Card>);
    fireEvent.pointerMove(screen.getByTestId('card'), { pointerType: 'mouse' });
    expect(own).toHaveBeenCalledTimes(1);
  });

  it('a primary button throws sparks on press, then clears them', () => {
    vi.useFakeTimers();
    motion(false);
    render(<Button>Join</Button>);
    const button = screen.getByRole('button', { name: 'Join' });
    const atRest = button.innerHTML;
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10 });
    expect(button.querySelectorAll('.animate-press-spark')).toHaveLength(8);
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(button.innerHTML).toBe(atRest);
    vi.useRealTimers();
  });

  it('no sparks under reduced motion, and none from a non-primary button', () => {
    motion(true);
    const { rerender } = render(<Button>Join</Button>);
    fireEvent.pointerDown(screen.getByRole('button'));
    expect(screen.getByRole('button').querySelectorAll('.animate-press-spark')).toHaveLength(0);
    motion(false);
    rerender(<Button variant="danger">Leave</Button>);
    fireEvent.pointerDown(screen.getByRole('button'));
    expect(screen.getByRole('button').querySelectorAll('.animate-press-spark')).toHaveLength(0);
  });

  it('sparkles are decoration only', () => {
    const { container } = render(<Sparkles>₹750</Sparkles>);
    expect(container.textContent).toBe('₹750');
    for (const star of container.querySelectorAll('svg')) expect(star).toHaveAttribute('aria-hidden', 'true');
  });

  it('every new animation is stopped by the reduced-motion block', () => {
    const query = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const name of ['.animate-press-spark', '.animate-twinkle', '.ink-shimmer']) {
      expect(query, name).toContain(name);
    }
  });
});
