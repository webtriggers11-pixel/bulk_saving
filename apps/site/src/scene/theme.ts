/**
 * FEAT-028: scheme + accent switching, the app's contract (ADR-0028/0031): attributes on
 * <html>, the same localStorage keys, theme-color follows the ground. The pre-paint script in
 * Base.astro applies the stored choice before first paint; this module only changes it.
 */

export const ACCENTS = ['mono', 'ocean', 'aurora', 'bloom', 'sunset', 'forest', 'lagoon'] as const;
export type Accent = (typeof ACCENTS)[number];
export type Scheme = 'light' | 'dark';

const GROUND: Record<Scheme, string> = { light: 'rgb(250, 250, 250)', dark: 'rgb(10, 10, 10)' };

const store = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: the choice lasts the visit */
  }
};

export const currentScheme = (): Scheme =>
  document.documentElement.getAttribute('data-scheme') === 'dark' ? 'dark' : 'light';

export const currentAccent = (): Accent => {
  const a = document.documentElement.getAttribute('data-accent');
  return (ACCENTS as readonly string[]).includes(a ?? '') ? (a as Accent) : 'mono';
};

export interface RevealOrigin {
  x: number;
  y: number;
}

/**
 * The app's night-mode gesture (FEAT-016, ADR-0028): the new scheme grows as a circle from
 * the switch, via View Transitions. Without the API, with reduced motion, or with no origin
 * the change is instant.
 */
const withReveal = (change: () => void, origin?: RevealOrigin) => {
  const doc = document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } };
  if (!origin || !doc.startViewTransition || prefersReducedMotion()) {
    change();
    return;
  }
  const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
  const transition = doc.startViewTransition(change);
  void transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 520, easing: 'cubic-bezier(0.22, 0.8, 0.28, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {
      /* a skipped transition still applied the change */
    });
};

export const setScheme = (scheme: Scheme, origin?: RevealOrigin) => {
  withReveal(() => {
    document.documentElement.setAttribute('data-scheme', scheme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', GROUND[scheme]);
    store('bulk:scheme', scheme);
    document.dispatchEvent(new CustomEvent('bulk:theme'));
  }, origin);
};

export const setAccent = (accent: Accent) => {
  document.documentElement.setAttribute('data-accent', accent);
  store('bulk:palette', accent);
  document.querySelectorAll<HTMLElement>('[data-set-accent]').forEach((el) => {
    el.setAttribute('aria-pressed', String(el.dataset.setAccent === accent));
  });
  document.dispatchEvent(new CustomEvent('bulk:theme'));
};

/** Wire every switch on the page. Idempotent. */
export const mountThemeControls = () => {
  document.querySelectorAll<HTMLElement>('[data-toggle-scheme]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const r = el.getBoundingClientRect();
      const origin = e.detail === 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY };
      setScheme(currentScheme() === 'dark' ? 'light' : 'dark', origin);
    });
  });
  document.querySelectorAll<HTMLElement>('[data-set-accent]').forEach((el) => {
    el.setAttribute('aria-pressed', String(el.dataset.setAccent === currentAccent()));
    el.addEventListener('click', () => {
      const a = el.dataset.setAccent;
      if ((ACCENTS as readonly string[]).includes(a ?? '')) setAccent(a as Accent);
    });
  });
};

/** `--brand` as "r g b" → [r, g, b] in 0..1, read live from the tokens. */
export const readRgb = (token: string): [number, number, number] => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const parts = raw.split(/\s+/).map(Number);
  const [r = 0, g = 0, b = 0] = parts;
  return [r / 255, g / 255, b / 255];
};

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
