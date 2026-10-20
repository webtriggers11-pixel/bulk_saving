/**
 * FEAT-028 T5e: the "who it's for" switcher and the savings calculator. The arithmetic is
 * calc.ts; this wires sliders to outputs (numbers tween to their new value) and tabs to
 * panels. Reduced motion: values jump.
 */
import { gsap } from 'gsap';
import { calc, compactRupees, type CalcInput } from './calc';
import { prefersReducedMotion } from './theme';

export function mountAudience(root: HTMLElement) {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-audience-tab]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-audience-panel]'));
  const show = (key: string) => {
    tabs.forEach((t) => {
      const on = t.dataset.audienceTab === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      const on = p.dataset.audiencePanel === key;
      p.hidden = !on;
      if (on && !prefersReducedMotion()) gsap.fromTo(p, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform' });
    });
  };
  tabs.forEach((t, i) => (t.tabIndex = i === 0 ? 0 : -1));
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.audienceTab ?? '')));
  tabs.forEach((t, i) =>
    t.addEventListener('keydown', (e) => {
      const j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
      if (j < 0) return;
      e.preventDefault();
      const next = tabs[j];
      next?.focus();
      show(next?.dataset.audienceTab ?? '');
    }),
  );
}

export function mountCalculator(root: HTMLElement) {
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[data-calc]'));
  const outs = Array.from(root.querySelectorAll<HTMLElement>('[data-calc-out]'));
  const reduced = prefersReducedMotion();
  const shown: Record<string, number> = {};

  const read = (): CalcInput => {
    const v = (k: string, d: number) => Number(inputs.find((i) => i.dataset.calc === k)?.value ?? d);
    return {
      flats: v('flats', 200),
      joining: v('joining', 30) / 100,
      jobsPerFlat: v('jobsPerFlat', 2),
      singlePrice: v('singlePrice', 1000),
      discount: v('discount', 30) / 100,
      takeRate: v('takeRate', 10) / 100,
    };
  };

  // Tweens pass fractional values; money and jobs are whole numbers on screen.
  const format = (key: string, raw: number) => {
    const n = Math.round(raw);
    if (key === 'jobs') return n.toLocaleString('en-IN');
    if (key === 'pooledPrice' || key === 'savingPerJob' || key === 'perFlatSavings') return `₹${n.toLocaleString('en-IN')}`;
    return compactRupees(n);
  };

  const render = () => {
    const i = read();
    const o = calc(i) as unknown as Record<string, number>;
    inputs.forEach((inp) => {
      const label = root.querySelector<HTMLElement>(`[data-calc-value="${inp.dataset.calc}"]`);
      if (!label) return;
      const k = inp.dataset.calc ?? '';
      const n = Number(inp.value);
      label.textContent = k === 'joining' || k === 'discount' || k === 'takeRate' ? `${n}%` : k === 'singlePrice' ? `₹${n.toLocaleString('en-IN')}` : String(n);
    });
    outs.forEach((el) => {
      const key = el.dataset.calcOut ?? '';
      const target = o[key] ?? 0;
      if (reduced || shown[key] === undefined) {
        shown[key] = target;
        el.textContent = format(key, target);
        return;
      }
      const from = { v: shown[key] };
      gsap.to(from, { v: target, duration: 0.5, ease: 'power2.out', onUpdate: () => (el.textContent = format(key, from.v)) });
      shown[key] = target;
    });
  };
  inputs.forEach((i) => i.addEventListener('input', render));
  render();
}
