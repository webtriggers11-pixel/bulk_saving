import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FEAT-016 (ADR-0028): scheme preference + palette, applied to <html>, remembered per
 * device, and switched with the circular reveal only when that is allowed.
 *
 * The module keeps state from load, so each test imports a fresh copy after arranging
 * storage and the media queries the way a page load would find them.
 */
type Listener = (event: { matches: boolean }) => void;

function mockMedia({ dark = false, reduced = false } = {}) {
  const listeners: Listener[] = [];
  const query = (q: string) => ({
    matches: q.includes('prefers-color-scheme: dark') ? dark : q.includes('reduce') ? reduced : false,
    media: q,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
    removeEventListener: () => {},
  });
  vi.stubGlobal('matchMedia', vi.fn(query));
  window.matchMedia = vi.fn(query) as unknown as typeof window.matchMedia;
  return {
    flipSystem(nowDark: boolean) {
      dark = nowDark;
      for (const fn of listeners) fn({ matches: nowDark });
    },
  };
}

async function load() {
  vi.resetModules();
  return import('./appearance');
}

const root = () => document.documentElement;

describe('appearance', () => {
  beforeEach(() => {
    localStorage.clear();
    root().removeAttribute('data-scheme');
    root().removeAttribute('data-theme');
    document.head.innerHTML = '<meta name="theme-color" content="#000000">';
    delete (document as unknown as Record<string, unknown>).startViewTransition;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('defaults to following the system, and to teal', async () => {
    mockMedia({ dark: true });
    const a = await load();
    a.initAppearance();
    expect(root().dataset.scheme).toBe('dark');
    expect(root().dataset.theme).toBe('teal');
  });

  it('"system" follows the OS live — a phone going dark at sunset takes the app with it', async () => {
    const media = mockMedia({ dark: false });
    const a = await load();
    a.initAppearance();
    expect(root().dataset.scheme).toBe('light');
    media.flipSystem(true);
    expect(root().dataset.scheme).toBe('dark');
  });

  it('an explicit choice is remembered and survives a reload, and stops following the OS', async () => {
    const media = mockMedia({ dark: false });
    let a = await load();
    a.setSchemePreference('dark');
    expect(localStorage.getItem(a.SCHEME_KEY)).toBe('dark');
    media.flipSystem(false);
    expect(root().dataset.scheme).toBe('dark');

    a = await load(); // a fresh page load
    a.initAppearance();
    expect(root().dataset.scheme).toBe('dark');
  });

  it('the quick switch flips whatever is showing', async () => {
    mockMedia({ dark: false });
    const a = await load();
    a.toggleScheme();
    expect(root().dataset.scheme).toBe('dark');
    a.toggleScheme();
    expect(root().dataset.scheme).toBe('light');
  });

  it('remembers the palette, and ignores a palette it does not know', async () => {
    mockMedia();
    let a = await load();
    a.setPalette('ember');
    expect(root().dataset.theme).toBe('ember');
    localStorage.setItem(a.PALETTE_KEY, 'neon');
    a = await load();
    a.initAppearance();
    expect(root().dataset.theme).toBe('teal');
  });

  it('matches the status bar to the ground', async () => {
    mockMedia();
    root().style.setProperty('--ground', '11 20 19');
    const a = await load();
    a.initAppearance();
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('rgb(11, 20, 19)');
    root().style.removeProperty('--ground');
  });

  it('reveals the new scheme as a circle from the control — when View Transitions exist and motion is allowed', async () => {
    mockMedia({ reduced: false });
    const animate = vi.fn();
    root().animate = animate as unknown as typeof root.prototype.animate;
    const start = vi.fn((update: () => void) => {
      update();
      return { ready: Promise.resolve() };
    });
    (document as unknown as { startViewTransition: typeof start }).startViewTransition = start;
    const a = await load();

    a.toggleScheme({ x: 40, y: 60 });
    await Promise.resolve();
    await Promise.resolve();

    expect(start).toHaveBeenCalledTimes(1);
    expect(root().dataset.scheme).toBe('dark');
    const [frames, options] = animate.mock.calls[0];
    expect(frames.clipPath[0]).toBe('circle(0px at 40px 60px)');
    expect(options.pseudoElement).toBe('::view-transition-new(root)');
  });

  it('switches instantly under reduced motion — no transition at all', async () => {
    mockMedia({ reduced: true });
    const start = vi.fn();
    (document as unknown as { startViewTransition: typeof start }).startViewTransition = start;
    const a = await load();
    a.toggleScheme({ x: 40, y: 60 });
    expect(start).not.toHaveBeenCalled();
    expect(root().dataset.scheme).toBe('dark');
  });

  it('switches instantly where View Transitions are missing (Firefox today)', async () => {
    mockMedia();
    const a = await load();
    a.toggleScheme({ x: 40, y: 60 });
    expect(root().dataset.scheme).toBe('dark');
  });

  it('still works when storage is blocked — the choice lasts for the visit', async () => {
    mockMedia({ dark: false });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const a = await load();
    a.initAppearance();
    a.setSchemePreference('dark');
    expect(root().dataset.scheme).toBe('dark');
  });
});
