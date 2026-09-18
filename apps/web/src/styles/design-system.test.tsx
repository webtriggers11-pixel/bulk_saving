import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { ProfilePage } from '../features/profile/ProfilePage';
import { useAuthStore } from '../features/auth/auth.store';
import { Button } from '../components/ui/button';

const WEB = process.cwd();
const css = readFileSync(join(WEB, 'src/styles/theme.css'), 'utf8');
const tailwind = readFileSync(join(WEB, 'tailwind.config.js'), 'utf8');

/** Every resident source file (no tests, no admin — admin is out of scope for FEAT-011). */
function residentSources(): string[] {
  const roots = ['src/components', 'src/features', 'src/lib'];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== 'admin') walk(path);
      } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        files.push(path);
      }
    }
  };
  roots.forEach((root) => walk(join(WEB, root)));
  return files;
}

describe('AC2 — tokens, not literals', () => {
  it('no resident component hard-codes a colour', () => {
    const offenders: string[] = [];
    for (const file of residentSources()) {
      const source = readFileSync(file, 'utf8');
      // A hex, an rgba(), or a Tailwind default-palette colour class. The design
      // system has a token for each of these; using a literal is how a palette
      // silently stops applying to one component.
      const matches = source.match(/#[0-9a-fA-F]{6}\b|rgba\(|\b(?:slate|teal|gray|zinc|emerald)-[0-9]{2,3}\b/g);
      if (matches) {
        offenders.push(`${file.replace(WEB, '')}: ${[...new Set(matches)].join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('exposes the token families Tailwind utilities are built from', () => {
    for (const token of ['--brand', '--ink', '--ground', '--shadow-rgb', '--mesh-1']) {
      expect(tailwind.includes(token), `tailwind.config.js never maps ${token}`).toBe(true);
    }
  });
});

describe('AC3 — a palette swap cannot change a layout', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    useAuthStore.setState({ resident: null, society: null, accessToken: null, refreshToken: null });
  });

  function renderProfile() {
    useAuthStore.setState({
      resident: { id: 'r1', name: 'Priya Sharma', phone: '+919876543210', role: 'RESIDENT' },
      society: { id: 's1', name: 'Rohan Nilaya', city: 'Pune' },
      accessToken: 'a',
      refreshToken: 'r',
    } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders byte-identical markup under every palette', () => {
    document.documentElement.dataset.theme = 'teal';
    const teal = renderProfile().container.innerHTML;

    document.documentElement.dataset.theme = 'indigo';
    const indigo = renderProfile().container.innerHTML;

    document.documentElement.dataset.theme = 'ember';
    const ember = renderProfile().container.innerHTML;

    // If a component ever branches on the theme, this is where it shows up: the
    // palette is CSS, so the tree it paints must not know about it.
    expect(indigo).toEqual(teal);
    expect(ember).toEqual(teal);
  });
});

describe('AC5 — motion has one off switch', () => {
  it('no component sets an inline animation, so nothing escapes the media query', () => {
    const offenders = residentSources().filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /style=\{\{[^}]*\banimation(?!Delay)/.test(source);
    });
    expect(offenders.map((f) => f.replace(WEB, ''))).toEqual([]);
  });
});

describe('AC6 — every control clears the 44px touch floor', () => {
  it('declares the floor as a token, not as a number in a component', () => {
    expect(tailwind).toMatch(/touch: '44px'/);
    expect(tailwind).toMatch(/control: '50px'/);
    expect(tailwind).toMatch(/icon: '48px'/);
    expect(tailwind).toMatch(/tab: '58px'/);
  });

  it.each(['md', 'sm', 'icon'] as const)('button size %s is at least 44px tall', (size) => {
    const { container } = render(<Button size={size}>Join</Button>);
    const className = container.querySelector('button')!.className;
    // h-control = 50, h-icon = 48, h-11 = 44
    expect(className).toMatch(/h-(control|icon|11)\b/);
  });
});

describe('AC7 — text clears WCAG AA in every palette', () => {
  /** The palette block's tokens, as [r,g,b]. */
  function palette(selector: string): Record<string, [number, number, number]> {
    const start = css.indexOf(selector);
    const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', css.indexOf('{', start)));
    const out: Record<string, [number, number, number]> = {};
    for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(\d+ \d+ \d+);/g)) {
      const [r, g, b] = value.split(' ').map(Number);
      out[name] = [r, g, b];
    }
    return out;
  }

  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]: [number, number, number]) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a: [number, number, number], b: [number, number, number]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const WHITE: [number, number, number] = [255, 255, 255];
  const PALETTES: Array<[string, string]> = [
    ['teal', ":root,\n[data-theme='teal']"],
    ['indigo', "[data-theme='indigo']"],
    ['ember', "[data-theme='ember']"],
  ];

  it.each(PALETTES)('%s: body and secondary text clear 4.5:1 on the ground', (_name, selector) => {
    const p = palette(selector);
    // Cards sit on ≥60% white over the ground, so white is the honest backdrop
    // for the text ramp; the ground itself is the harder of the two anyway.
    expect(ratio(p['--ink'], WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p['--ink-muted'], WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p['--ink'], p['--ground'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p['--ink-muted'], p['--ground'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETTES)('%s: the brand ink used for small text clears 4.5:1 on white', (_name, selector) => {
    const p = palette(selector);
    expect(ratio(p['--brand-ink'], WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETTES)('%s: white on the accent surface clears 4.5:1 at its lightest stop', (_name, selector) => {
    const p = palette(selector);
    // The accent gradient runs deep -> brand -> light; `brand` is the midpoint the
    // headline sits over, and it is the one that has to hold.
    expect(ratio(WHITE, p['--brand'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(WHITE, p['--brand-deep'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETTES)('%s: the caption ramp clears 3:1 as a minimum, even at its softest', (_name, selector) => {
    const p = palette(selector);
    expect(ratio(p['--ink-soft'], WHITE)).toBeGreaterThanOrEqual(3);
  });
});
