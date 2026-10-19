import { useSyncExternalStore } from 'react';

/**
 * Appearance — colour scheme and palette (FEAT-016, ADR-0028).
 *
 * Two attributes on <html>, orthogonal: `data-scheme` (light | dark) and `data-theme`
 * (the palette). The person chooses a scheme PREFERENCE — light, dark, or follow the
 * system — and a palette; both are remembered per device. index.html applies them before
 * first paint (no flash of the wrong scheme); this module owns them after that.
 *
 * Storage is a per-device convenience: every read and write is guarded, and the app
 * renders correctly (system scheme, Mono) when storage is unavailable.
 */

export type SchemePreference = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';
/**
 * The colour inside the Vercel look (FEAT-019, ADR-0031): seven accent PAIRS. Stored under
 * the old palette key; the three retired glass palettes migrate to their nearest pair.
 */
export type Palette = 'mono' | 'ocean' | 'aurora' | 'bloom' | 'sunset' | 'forest' | 'lagoon';

export const SCHEME_KEY = 'bulk:scheme';
export const PALETTE_KEY = 'bulk:palette';
/** Mono first: it is the default for a device that has not chosen (FEAT-017, ADR-0029). */
export const PALETTES: readonly Palette[] = ['mono', 'ocean', 'aurora', 'bloom', 'sunset', 'forest', 'lagoon'];

/** FEAT-019: the glass palettes are retired; a device that chose one keeps its colour. */
const LEGACY: Record<string, Palette> = { teal: 'lagoon', indigo: 'aurora', ember: 'sunset' };

interface Appearance {
  preference: SchemePreference;
  scheme: Scheme;
  palette: Palette;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: the choice lasts for this visit only.
  }
}

function systemScheme(): Scheme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function asPreference(value: string | null): SchemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function asPalette(value: string | null): Palette {
  if (value && (PALETTES as readonly string[]).includes(value)) return value as Palette;
  return (value && LEGACY[value]) || 'mono';
}

function resolve(preference: SchemePreference): Scheme {
  return preference === 'system' ? systemScheme() : preference;
}

let state: Appearance = (() => {
  const preference = asPreference(read(SCHEME_KEY));
  return { preference, scheme: resolve(preference), palette: asPalette(read(PALETTE_KEY)) };
})();
const listeners = new Set<() => void>();

/** Paint the current state onto <html>, and match the phone's status bar to the ground. */
function apply(): void {
  const root = document.documentElement;
  root.dataset.scheme = state.scheme;
  // FEAT-019 (ADR-0031): one look — Vercel, on Mono's neutral base — and the accent pair.
  root.dataset.look = 'vercel';
  root.dataset.theme = 'mono';
  root.dataset.accent = state.palette;
  const ground = getComputedStyle(root).getPropertyValue('--ground').trim();
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta && ground) {
    meta.content = `rgb(${ground.split(/\s+/).join(', ')})`;
  }
}

function set(next: Partial<Appearance>): void {
  state = { ...state, ...next };
  apply();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// "System" follows the OS live — a phone switching to night at sunset switches the app.
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (state.preference === 'system') set({ scheme: systemScheme() });
  });
}

/** The point a reveal grows from: the centre of the control that asked for it. */
export interface RevealOrigin {
  x: number;
  y: number;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

/**
 * Change the scheme the way Telegram's night switch does: the new scheme grows as a
 * circle from the control that was tapped, over the old one (ADR-0028). View Transitions
 * snapshot the page before and after; the new snapshot is clipped to a growing circle.
 * Instant when motion is reduced, when View Transitions are missing (Firefox today), or
 * when no origin is given.
 */
function withReveal(change: () => void, origin?: RevealOrigin): void {
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { ready: Promise<void> };
  };
  if (!origin || !doc.startViewTransition || prefersReducedMotion()) {
    change();
    return;
  }
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );
  const transition = doc.startViewTransition(change);
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: 520,
          easing: 'cubic-bezier(0.22, 0.8, 0.28, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {
      // A skipped transition still applied the change; nothing to animate.
    });
}

export function setSchemePreference(preference: SchemePreference, origin?: RevealOrigin): void {
  write(SCHEME_KEY, preference);
  const scheme = resolve(preference);
  if (scheme === state.scheme) {
    set({ preference });
    return;
  }
  withReveal(() => set({ preference, scheme }), origin);
}

/** The quick switch: flip whatever is showing, and remember it as an explicit choice. */
export function toggleScheme(origin?: RevealOrigin): void {
  setSchemePreference(state.scheme === 'dark' ? 'light' : 'dark', origin);
}

export function setPalette(palette: Palette, origin?: RevealOrigin): void {
  write(PALETTE_KEY, palette);
  if (palette === state.palette) return;
  withReveal(() => set({ palette }), origin);
}

/** The centre of an element, for `origin`. */
export function originOf(element: Element): RevealOrigin {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Apply the stored appearance once on boot (index.html already did, before paint). */
export function initAppearance(): void {
  apply();
}

/** Test seam: re-read storage and the OS, as a fresh page load would. */
export function reloadAppearanceForTest(): void {
  const preference = asPreference(read(SCHEME_KEY));
  state = { preference, scheme: resolve(preference), palette: asPalette(read(PALETTE_KEY)) };
  apply();
  for (const listener of listeners) listener();
}
