/**
 * FEAT-028: the page's micro-interactions. Each one is a few lines, each one checks the
 * motion preference, none of them touches layout. The CSS lives in fx.css.
 */
import { prefersReducedMotion } from './theme';

const STAR =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0c.4 2.6 2.4 4.6 5 5-2.6.4-4.6 2.4-5 5-.4-2.6-2.4-4.6-5-5 2.6-.4 4.6-2.4 5-5z"/></svg>';

/** (a) Spotlight: write --mx/--my on pointer move so the CSS disc can follow. */
export const mountSpotlight = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLElement>('.card-hover').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
};

/** (e) Press sparks from where a primary button was pressed. */
export const mountPressSparks = (root: ParentNode = document) => {
  if (prefersReducedMotion()) return;
  root.querySelectorAll<HTMLElement>('.btn--primary').forEach((btn) => {
    btn.classList.add('spark-host');
    btn.addEventListener('pointerdown', (e) => {
      if (btn.hasAttribute('disabled')) return;
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      for (let i = 0; i < 7; i++) {
        const s = document.createElement('i');
        s.className = 'press-spark';
        const a = (i / 7) * Math.PI * 2 + Math.random() * 0.6;
        const d = 18 + Math.random() * 22;
        s.style.left = `${x}px`;
        s.style.top = `${y}px`;
        s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
        s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
        btn.appendChild(s);
        s.addEventListener('animationend', () => s.remove());
      }
    });
  });
};

/** (c) Sparkles: put three stars around an element and switch them on or off. */
export const sparkles = (el: HTMLElement) => {
  if (!el.classList.contains('sparkles')) {
    el.classList.add('sparkles');
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      s.innerHTML = STAR;
      el.appendChild(s);
    }
  }
  return {
    on: () => el.classList.toggle('is-on', !prefersReducedMotion()),
    off: () => el.classList.remove('is-on'),
  };
};

/** (g) Reveal each section once as it enters. Without JS the sections are simply visible. */
export const mountReveal = () => {
  const els = document.querySelectorAll<HTMLElement>('.reveal');
  if (!els.length) return;
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
  );
  els.forEach((el) => io.observe(el));
};

/** (h) Tilt: the phone mocks lean toward the pointer, and settle when it leaves. */
export const mountTilt = (root: ParentNode = document) => {
  if (prefersReducedMotion() || !matchMedia('(hover: hover)').matches) return;
  root.querySelectorAll<HTMLElement>('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${px * 10}deg`);
      el.style.setProperty('--rx', `${-py * 8}deg`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    });
  });
};

/** Count up a figure when it scrolls into view. `data-count-to="41300" data-prefix="₹"`. */
export const mountCountUp = () => {
  const els = document.querySelectorAll<HTMLElement>('[data-count-to]');
  if (!els.length) return;
  const fmt = (n: number, decimals: number) => {
    const fixed = n.toFixed(decimals);
    const [int = '0', frac] = fixed.split('.');
    const head = int.slice(0, -3);
    const tail = int.slice(-3);
    const grouped = int.length > 3 ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}` : int;
    return frac ? `${grouped}.${frac}` : grouped;
  };
  const run = (el: HTMLElement) => {
    const to = Number(el.dataset.countTo ?? 0);
    const decimals = (el.dataset.countTo ?? '').split('.')[1]?.length ?? 0;
    const prefix = el.dataset.prefix ?? '';
    if (prefersReducedMotion()) {
      el.textContent = prefix + fmt(to, decimals);
      return;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = prefix + fmt(to * eased, decimals);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) {
    els.forEach(run);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        run(e.target as HTMLElement);
        io.unobserve(e.target);
      }
    }
  });
  els.forEach((el) => io.observe(el));
};

export const mountFx = () => {
  document.documentElement.classList.add('js');
  mountSpotlight();
  mountPressSparks();
  mountReveal();
  mountTilt();
  mountCountUp();
};
