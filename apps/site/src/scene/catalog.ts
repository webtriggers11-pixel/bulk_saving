/**
 * FEAT-028 T5d: the catalog wall. Chips + search filter the cards with a GSAP Flip (the
 * cards slide to their new places, leavers fade); open rounds tick their deadline every
 * minute; "Ask for this" toggles with a count and a sparkle; an open card's button opens
 * the pledge sheet (a native <dialog>: focus trap and Escape for free) whose stepper reprices
 * through the app's tier rule. Reduced motion: instant layout, no sparkles. The wall holds
 * its height through the Flip (BUG-023) so the page below never jumps.
 */
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { catalog, type Category } from '../content/features';
import { askLabel, closesIn, filterCatalog, sheetFor, toggleAsk, type Filter } from './catalogModel';
import { rupees } from './model';
import { sparkles } from './fx';
import { prefersReducedMotion } from './theme';

gsap.registerPlugin(Flip, ScrollTrigger);

export function mountCatalog(root: HTMLElement) {
  const reduced = prefersReducedMotion();
  const wall = root.querySelector<HTMLElement>('[data-catalog-wall]');
  const q = root.querySelector<HTMLInputElement>('[data-catalog-q]');
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-chip]'));
  const count = root.querySelector<HTMLElement>('[data-catalog-count]');
  const empty = root.querySelector<HTMLElement>('[data-catalog-empty]');
  const clear = root.querySelector<HTMLButtonElement>('[data-catalog-clear]');
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-service]'));
  if (!wall || !q) return;

  // ---- filter + Flip -----------------------------------------------------------------------
  const filter: Filter = { category: 'all', q: '' };
  const items = cards.map((el) => ({ el, name: el.dataset.name ?? '', category: el.dataset.category as Category }));
  let debounce = 0;

  const applyFilter = () => {
    const keep = new Set(filterCatalog(items, filter).map((i) => i.el));
    const state = reduced ? null : Flip.getState(cards);
    const h0 = wall.offsetHeight;
    cards.forEach((el) => (el.style.display = keep.has(el) ? '' : 'none'));
    if (state) {
      // BUG-023: only the leavers go absolute, so the grid keeps sizing itself from the cards
      // that stay; the wall tweens its own height from the old layout to the new one on the
      // same timeline, so the sections below glide instead of jumping up over the cards.
      const h1 = wall.offsetHeight;
      const tl = Flip.from(state, {
        duration: 0.55,
        ease: 'power2.inOut',
        stagger: 0.015,
        absoluteOnLeave: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.4 }),
        onLeave: (els) => {
          els.forEach((el) => el.classList.add('svc--leaving'));
          return gsap.to(els, { opacity: 0, scale: 0.96, duration: 0.2, onComplete: () => els.forEach((el) => el.classList.remove('svc--leaving')) });
        },
        onComplete: () => {
          gsap.set(wall, { clearProps: 'height' });
          ScrollTrigger.refresh();
        },
      });
      tl.fromTo(wall, { height: h0 }, { height: h1, duration: 0.55, ease: 'power2.inOut', overwrite: true, clearProps: 'height' }, 0);
    }
    const n = keep.size;
    if (count) {
      const open = cards.filter((el) => keep.has(el) && el.classList.contains('svc--open')).length;
      count.textContent = n === cards.length ? `${n} services · ${open} open rounds · ${cards.filter((el) => el.classList.contains('svc--asked')).length} with neighbours asking` : `${n} of ${cards.length} services${open ? ` · ${open} open` : ''}`;
    }
    if (empty) empty.hidden = n > 0;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.chip === filter.category)));
  };
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      filter.category = (c.dataset.chip as Category | 'all') ?? 'all';
      applyFilter();
    }),
  );
  q.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      filter.q = q.value;
      applyFilter();
    }, 180);
  });
  clear?.addEventListener('click', () => {
    filter.category = 'all';
    filter.q = '';
    q.value = '';
    applyFilter();
  });

  // ---- deadlines tick ---------------------------------------------------------------------
  const started = Date.now();
  const tick = () => {
    cards.forEach((el) => {
      const hours = Number(el.dataset.hours);
      const out = el.querySelector<HTMLElement>('[data-closes]');
      if (!out || Number.isNaN(hours)) return;
      out.textContent = closesIn(hours - (Date.now() - started) / 3.6e6);
    });
  };
  tick();
  window.setInterval(tick, 60_000);

  // ---- asks ---------------------------------------------------------------------------------
  root.querySelectorAll<HTMLButtonElement>('[data-ask]').forEach((btn) => {
    const i = Number(btn.dataset.ask);
    const label = root.querySelector<HTMLElement>(`[data-ask-label="${i}"]`);
    let state = { count: catalog[i]?.asked ?? 0, asked: false };
    const stars = label ? sparkles(label) : null;
    btn.addEventListener('click', () => {
      state = toggleAsk(state.count, state.asked);
      btn.setAttribute('aria-pressed', String(state.asked));
      btn.textContent = state.asked ? 'Asked' : 'Ask for this';
      btn.classList.toggle('btn--primary', state.asked);
      btn.classList.toggle('btn--ghost', !state.asked);
      if (label) label.textContent = askLabel(state.count, state.asked);
      if (state.asked) stars?.on();
      else stars?.off();
    });
  });

  // ---- the pledge sheet ----------------------------------------------------------------------
  const sheet = root.querySelector<HTMLDialogElement>('[data-sheet]');
  if (!sheet) return;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => sheet.querySelector<T>(sel);
  const title = $('[data-sheet-title]');
  const sub = $('[data-sheet-sub]');
  const unitsOut = $('[data-sheet-units]');
  const priceOut = $('[data-sheet-price]');
  const totalOut = $('[data-sheet-total]');
  const hintOut = $('[data-sheet-hint]');
  const join = $<HTMLButtonElement>('[data-sheet-join]');
  let current = -1;
  let units = 2;
  let closeTimer = 0;

  const renderSheet = () => {
    const item = catalog[current];
    if (!item?.round) return;
    const s = sheetFor(item.round, units, { one: item.unit, many: item.units });
    units = s.units;
    if (unitsOut) unitsOut.textContent = String(s.units);
    if (priceOut) priceOut.textContent = `${rupees(s.priceNow)} each`;
    if (totalOut) totalOut.textContent = rupees(s.total);
    if (hintOut) hintOut.textContent = s.hint;
  };
  const openSheet = (i: number) => {
    const item = catalog[i];
    if (!item?.round) return;
    clearTimeout(closeTimer);
    current = i;
    units = 2;
    if (title) title.textContent = item.name;
    // The deadline as the card shows it now (it ticks), not as it was at load.
    const closes = root.querySelector<HTMLElement>(`[data-service="${i}"] [data-closes]`)?.textContent ?? closesIn(item.round.hoursLeft);
    if (sub) sub.textContent = `${item.round.pledged} of ${item.round.target} ${item.units} · ${closes}`;
    if (join) {
      join.disabled = false;
      join.textContent = 'Join';
    }
    renderSheet();
    sheet.showModal();
    if (!reduced) gsap.fromTo(sheet, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: 'power3.out', clearProps: 'transform' });
  };
  root.querySelectorAll<HTMLButtonElement>('[data-open-sheet]').forEach((btn) =>
    btn.addEventListener('click', () => openSheet(Number(btn.dataset.openSheet))),
  );
  $('[data-sheet-dec]')?.addEventListener('click', () => {
    units -= 1;
    renderSheet();
  });
  $('[data-sheet-inc]')?.addEventListener('click', () => {
    units += 1;
    renderSheet();
  });
  $('[data-sheet-close]')?.addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close(); // the backdrop
  });
  join?.addEventListener('click', () => {
    const item = catalog[current];
    if (!item || !join) return;
    join.textContent = `You're in with ${units} ${units === 1 ? item.unit : item.units}`;
    join.disabled = true;
    closeTimer = window.setTimeout(() => sheet.close(), 1100);
  });
}
