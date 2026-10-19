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

/**
 * Every app source file. Admin was exempt while FEAT-011 ran; CHORE-008 put it on
 * the same system, so the exemption is gone and the rules apply to the whole app.
 */
function appSources(): string[] {
  const roots = ['src/components', 'src/features', 'src/lib'];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        files.push(path);
      }
    }
  };
  roots.forEach((root) => walk(join(WEB, root)));
  return files;
}

describe('AC2 — tokens, not literals', () => {
  it('no component hard-codes a colour', () => {
    const offenders: string[] = [];
    for (const file of appSources()) {
      const source = readFileSync(file, 'utf8');
      // A hex, an rgba(), or a Tailwind default-palette colour class. The design
      // system has a token for each of these; using a literal is how a palette
      // silently stops applying to one component.
      const matches = source.match(
        /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\b(?:slate|gray|zinc|neutral|stone|teal|emerald|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow|lime|green)-[0-9]{2,3}\b/g,
      );
      if (matches) {
        offenders.push(`${file.replace(WEB, '')}: ${[...new Set(matches)].join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Regression (found in the browser, not by a test): the primary button's gradient
   * class was named `fill-brand`, which Tailwind ALSO generates as an SVG `fill`
   * utility — so the rule that was never written silently lost to one that was, and
   * the app's main button rendered with no background at all. Every system class a
   * component names must exist in the stylesheet.
   */
  it('every bespoke system class a component uses is declared in theme.css', () => {
    // Not just surface-*/paint-*: `nudge` was declared only as `.btn .nudge`, under
    // an ancestor class no component carries, so the arrow never moved and nothing
    // failed. Any class the design system owns must exist as a rule of its own.
    // Longest alternative first: JS alternation is leftmost-first, so `field` would
    // otherwise swallow `field-label` and the test would pass with `.field-label`
    // deleted (V2 round 2, P2-1).
    const OWNED =
      /\b(surface-[a-z]+|paint-[a-z]+|animate-[a-z-]+|skeleton(?:-d[0-9])?|bar-fill|card-hover|card-glow|sheen|sweep|ripple|press|stagger|nudge|field-label|field|halo-sweep|num|sr-only-text)(?![a-z0-9-])/g;
    const used = new Set<string>();
    for (const file of appSources()) {
      for (const [, name] of readFileSync(file, 'utf8').matchAll(OWNED)) {
        used.add(name);
      }
    }
    expect(used.size).toBeGreaterThan(12);
    // A rule "of its own" means a selector that starts with the class, so a
    // component carrying only that class still matches it.
    const missing = [...used].filter(
      (name) => !new RegExp(`^\\.${name}(?![a-z0-9-])`, 'm').test(css),
    );
    expect(missing).toEqual([]);
  });

  it('names no system class that collides with a generated Tailwind utility family', () => {
    // `fill-*`, `stroke-*`, `bg-*`, `text-*` are Tailwind's; a hand-written class in
    // those namespaces is a rule you think you wrote and never see.
    const declared = [...css.matchAll(/^\.([a-z][a-z0-9-]*) \{/gm)].map((m) => m[1]);
    const colliding = declared.filter((name) => /^(fill|stroke|bg|text|border|shadow|rounded)-/.test(name));
    expect(colliding).toEqual([]);
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

  /** Render, read, unmount — a still-mounted copy would re-render when the next one
   * resets the store, outside act() (CHORE-013). */
  function markupUnder(theme: string): string {
    document.documentElement.dataset.theme = theme;
    const view = renderProfile();
    const html = view.container.innerHTML;
    view.unmount();
    return html;
  }

  it('renders byte-identical markup under every palette', () => {
    const teal = markupUnder('teal');
    const indigo = markupUnder('indigo');
    const ember = markupUnder('ember');
    const mono = markupUnder('mono');

    // If a component ever branches on the theme, this is where it shows up: the
    // palette is CSS, so the tree it paints must not know about it.
    expect(indigo).toEqual(teal);
    expect(ember).toEqual(teal);
    expect(mono).toEqual(teal);
  });
});

describe('AC5 — motion has one off switch', () => {
  it('resets delays as well as durations', () => {
    // `rise` starts at opacity 0. Collapsing the duration but not the DELAY leaves a
    // staggered child invisible for up to 600ms and then snapping in — worse than
    // the animation it was meant to remove (V2 P2-2).
    const query = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(query).toContain('animation-delay: 0s !important');
    expect(query).toContain('transition-delay: 0s !important');
  });

  it('an animation that ENDS invisible is switched off, not just shortened (FEAT-015 V2 P1-1)', () => {
    // Collapsing the duration jumps a `both`-filled animation to its last frame. For one
    // that ends at opacity 0 — the "Saved" tick — that frame is nothing: the confirmation
    // was invisible for its whole life to anyone who asked for less motion.
    const query = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    const fadesOut = [...css.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\n\}/g)]
      .filter(([, , body]) => /(?:100%|\bto)\s*\{[^}]*opacity:\s*0\s*;/.test(body))
      .map(([, name]) => name);
    expect(fadesOut, 'found no fade-out keyframes — this check is vacuous').toContain('saved-flash');

    const unguarded: string[] = [];
    for (const name of fadesOut) {
      for (const [, selector] of css.matchAll(new RegExp(`(\\.[\\w-]+)\\s*\\{[^}]*animation:\\s*${name}\\b[^}]*\\b(?:both|forwards)\\b`, 'g'))) {
        const disabled = new RegExp(`\\${selector}\\s*\\{[^}]*animation:\\s*none`).test(query);
        if (!disabled) unguarded.push(`${selector} (${name})`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it('no component sets an inline animation, so nothing escapes the media query', () => {
    const offenders = appSources().filter((file) => {
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

  it('no component shrinks a control below the 44px floor, on either axis', () => {
    // `cn` is a plain join, not tailwind-merge: an `h-[42px]` passed to a sized
    // Button does NOT replace `h-icon`, it fights it, and stylesheet order decides.
    // So a sub-floor size on an interactive element is banned outright — named
    // (`h-10`) as well as arbitrary (`h-[40px]`), height as well as width.
    const REM_STEP = 4; // Tailwind's numeric scale is n * 0.25rem = n * 4px
    const offenders: string[] = [];
    for (const file of appSources()) {
      const source = readFileSync(file, 'utf8');
      const lineOf = (index: number) => source.slice(0, index).split('\n').length;
      // `(?![/\d])` so `w-1/2` is not read as `w-1` (4px) and falsely flagged.
      for (const match of source.matchAll(/(?:min-)?([hw])-(?:\[(\d+)px\]|(\d+(?:\.\d+)?))(?![/\d])\b/g)) {
        const px = match[2] ? Number(match[2]) : Number(match[3]) * REM_STEP;
        if (px >= 44) continue;
        // In a primitive that RENDERS a control, every size literal is a control's
        // size — including the ones in a variant map, where the "nearest <" heuristic
        // lands on a TSX generic (`ButtonHTMLAttributes<HTMLButtonElement>`) and sees
        // nothing. That map is the highest-leverage place a violation could hide: one
        // wrong value there shrinks every button in the app.
        const isControlPrimitive = /components\/ui\/(button|input|select)\.tsx$/.test(file);
        const before = source.slice(0, match.index ?? 0);
        const openedTag = before.lastIndexOf('<');
        const context = source.slice(openedTag, (match.index ?? 0) + match[0].length);
        const onAControl =
          /^<(button|a|input|textarea|select|Button|NavLink|Link)\b/.test(context) || /onClick=/.test(context);
        if (isControlPrimitive || onAControl) {
          offenders.push(`${file.replace(WEB, '')}:${lineOf(match.index ?? 0)} ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
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
    ['mono', "[data-theme='mono'] {"],
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

  it.each(PALETTES)('%s: fill text on the accent surface clears 4.5:1 at its lightest stop', (_name, selector) => {
    // Read `--on-fill` (shared :root by day) rather than assuming white (FEAT-017 V2 P3-3).
    const onFill = palette(":root {\n  color-scheme: light;")['--on-fill'];
    expect(onFill).toEqual(WHITE);
    const p = palette(selector);
    // The accent gradient runs deep -> brand -> light; `brand` is the midpoint the
    // headline sits over, and it is the one that has to hold.
    expect(ratio(onFill, p['--brand'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(onFill, p['--brand-deep'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETTES)('%s: even the softest ink clears 4.5:1 — it carries 9.5–13px text', (_name, selector) => {
    // --ink-soft labels the tier ring (9.5px), unit scope (10.5px) and the "/ room"
    // suffix (13px). All of that is small text, so the large-text 3:1 allowance
    // never applied to it (V2 P2-4).
    const p = palette(selector);
    expect(ratio(p['--ink-soft'], WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p['--ink-soft'], p['--ground'])).toBeGreaterThanOrEqual(4.5);
  });
  /**
   * FEAT-016 (ADR-0028): every palette has a NIGHT, and the night is held to the same bar.
   * At night the surfaces are `paper` (the night surface), not white, so that is the
   * honest backdrop; state hues carry small text too, so they are checked as well.
   */
  const NIGHTS: Array<[string, string]> = [
    ['teal', "html[data-scheme='dark']:not([data-theme='indigo']):not([data-theme='ember']):not([data-theme='mono'])"],
    ['indigo', "html[data-scheme='dark'][data-theme='indigo']"],
    ['ember', "html[data-scheme='dark'][data-theme='ember']"],
    ['mono', "html[data-scheme='dark'][data-theme='mono'] {"],
  ];
  const sharedNight = () => palette("[data-scheme='dark'] {");

  it.each(NIGHTS)('%s night: every ink clears 4.5:1 on its ground AND on its surface', (_name, selector) => {
    const p = palette(selector);
    for (const ink of ['--ink', '--ink-muted', '--ink-soft', '--brand-ink'] as const) {
      expect(ratio(p[ink], p['--ground']), `${ink} on ground`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p[ink], p['--paper']), `${ink} on paper`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(NIGHTS)('%s night: the fill text (on-fill) on the accent fill still clears 4.5:1', (_name, selector) => {
    // FEAT-017 (ADR-0029): Mono's night fill is near-white, so fill text is a token —
    // white in the tinted nights, near-black in Mono's.
    const p = palette(selector);
    expect(p['--on-fill'], 'every night declares its fill text').toBeDefined();
    expect(ratio(p['--on-fill'], p['--brand'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p['--on-fill'], p['--brand-deep'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NIGHTS)('%s night: the state hues (error, offline, delivered, booked) read on its surface', (_name, selector) => {
    const p = { ...sharedNight(), ...palette(selector) };
    for (const state of ['--state-red', '--state-amber', '--state-green', '--state-blue'] as const) {
      expect(ratio(p[state], p['--paper']), `${state} on paper`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('every night declares the same tokens — a palette cannot forget part of its night', () => {
    const names = NIGHTS.map(([, selector]) => Object.keys(palette(selector)).sort());
    expect(names[1]).toEqual(names[0]);
    expect(names[2]).toEqual(names[0]);
    expect(names[3]).toEqual(names[0]);
    expect(names[0]).toEqual(expect.arrayContaining(['--ground', '--paper', '--ink', '--brand-ink', '--brand']));
  });

});

describe('FEAT-016 AC3 — no light-only colour outside the accent fills', () => {
  /**
   * `white` does not change at night. On a light surface that is a glowing rim on smoked
   * glass, so light-surface overlays use `paper` (ADR-0028). `white` is kept ONLY on brand
   * fills, which stay brand-coloured at night. This is the list; adding a file to it is a
   * design decision, not a fix for a red test.
   */
  /**
   * Each accent-fill file and EXACTLY how many white utilities it uses. A count, not a
   * free pass: a new `white` in one of these files is a new decision, and should have to
   * say so here (V2 P2-6). Adding or removing one means editing the number.
   */
  // FEAT-017 (ADR-0029): text and marks ON a fill now use `on-fill` (Mono's night fill is
  // near-white), so the list is down to marks whose backdrop is not the active fill.
  const ACCENT_FILL_USES: Record<string, number> = {
    'components/ui/switch.tsx': 1, // the knob is white in both schemes, like iOS
    'features/appearance/AppearanceSheet.tsx': 1, // the tick on a swatch: always a day fill
  };
  // Every utility that can paint a colour, plus arbitrary white literals.
  const WHITE = /\b(?:bg|border|from|to|via|ring|divide|text|stroke|fill|shadow|outline|decoration|caret|accent|placeholder)-white\b|-\[(?:#fff(?:fff)?|white|rgb\(255[ ,_]+255[ ,_]+255)/gi;

  it('uses white only on accent fills — and exactly as often as the allowlist says', () => {
    const offenders: string[] = [];
    const counts: Record<string, number> = {};
    for (const file of appSources()) {
      const rel = file.replace(/^.*\/src\//, '');
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(WHITE)) {
        const line = source.slice(0, match.index ?? 0).split('\n').length;
        const text = source.split('\n')[line - 1].trim();
        if (text.startsWith('*') || text.startsWith('//')) continue;
        counts[rel] = (counts[rel] ?? 0) + 1;
        if (!(rel in ACCENT_FILL_USES)) offenders.push(`${rel}:${line} ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
    for (const [file, expected] of Object.entries(ACCENT_FILL_USES)) {
      expect(counts[file] ?? 0, `${file} white uses`).toBe(expected);
    }
  });

  it('the pre-paint status-bar colours in index.html are the ground tokens (V2 P2-9)', () => {
    const html = readFileSync(join(WEB, 'index.html'), 'utf8');
    const ground = (selector: string) => {
      const start = css.indexOf(selector);
      const block = css.slice(start, css.indexOf('}', start));
      const [, rgb] = /--ground:\s*(\d+ \d+ \d+);/.exec(block) ?? [];
      return `rgb(${rgb.split(' ').join(', ')})`;
    };
    const expected: Record<string, string> = {
      'light:teal': ground(":root,\n[data-theme='teal']"),
      'light:indigo': ground("[data-theme='indigo'] {"),
      'light:ember': ground("[data-theme='ember'] {"),
      'light:mono': ground("[data-theme='mono'] {"),
      'dark:mono': ground("html[data-scheme='dark'][data-theme='mono'] {"),
      'dark:teal': ground("html[data-scheme='dark']:not([data-theme='indigo'])"),
      'dark:indigo': ground("html[data-scheme='dark'][data-theme='indigo']"),
      'dark:ember': ground("html[data-scheme='dark'][data-theme='ember']"),
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(html, key).toContain(`'${key}': '${value}'`);
    }
  });
});

describe('FEAT-017 — Mono keeps every focus ring and the switch knob (V2 P1-1, P1-2)', () => {
  /**
   * Mono's overrides are `html[data-theme='mono'] .x` — they outrank a single focus
   * utility. Every focus-shadow utility a component uses must therefore have a Mono rule
   * of its own, or that control has no visible focus in the default palette.
   */
  it('every focus box-shadow utility in a component has a Mono rule that outranks the overrides', () => {
    const used = new Set<string>();
    for (const file of appSources()) {
      for (const [m] of readFileSync(file, 'utf8').matchAll(/\b(?:group-)?focus(?:-visible)?:shadow-[a-z]+/g)) {
        used.add(m);
      }
    }
    expect(used.size, 'found no focus utilities — this check is vacuous').toBeGreaterThan(1);
    const mono = css.slice(css.indexOf('/* Focus (FEAT-017 V2 P1-1)'));
    for (const utility of used) {
      const escaped = utility.replace(':', '\\:');
      expect(mono, `${utility} has no Mono focus rule`).toContain(`html[data-theme='mono']`);
      expect(mono.includes(`.${escaped}`), `${utility} has no Mono focus rule`).toBe(true);
    }
  });

  it("the switch knob takes the fill text on Mono's near-white night fill", () => {
    expect(css).toMatch(
      /html\[data-scheme='dark'\]\[data-theme='mono'\] \.switch\[aria-checked='true'\] \.switch-knob \{\s*background-color: rgb\(var\(--on-fill\)\);/,
    );
  });
});
