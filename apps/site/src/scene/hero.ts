/**
 * FEAT-028 → FEAT-030: the hero demo, now something you play with. One state (units pledged
 * plus the lighting order) drives the DOM ladder, the SVG fallback and, when WebGL is there,
 * the Three.js society. FEAT-030 adds: tap a window to invite that flat, drag to turn the
 * towers (building.ts), a live feed of who joined, a "+N" chip that arcs from the window to
 * the price, a price that counts down, an unlock banner, and a few seconds of idle autoplay
 * so the page is alive before the visitor touches it. The arithmetic is model.ts.
 */
import { demoRound } from '../content/features';
import {
  allWindows,
  flatLabel,
  flatOf,
  ladderProgress,
  lightingOrder,
  litCount,
  litSet,
  nextTier,
  priceFor,
  promote,
  rupees,
  savingPerUnit,
  tierIndex,
  unlocked,
} from './model';
import type { Building } from './building';
import { sparkles } from './fx';
import { prefersReducedMotion } from './theme';

const MY_UNITS = 2;
/** Autoplay brings neighbours until this many units: past the first tier, short of the best. */
const AUTO_UNTIL = 6;
const AUTO_FIRST = 2600;
const AUTO_EVERY = 2400;
const FLIGHT = 950;
const FEED_MAX = 3;

const hasWebGL = (): boolean => {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

class MissingPart extends Error {}

export function mountHero(root: HTMLElement) {
  // Idempotent: a second call (dev hot reload) would double every join.
  if (root.dataset.mounted) return;
  root.dataset.mounted = 'true';
  // The markup is ours (Hero.astro); a missing part is a build mistake, not a runtime case.
  const must = <T extends Element = HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new MissingPart(`hero: ${sel} is missing`);
    return el;
  };
  let price: HTMLElement;
  let count: HTMLElement;
  let fill: HTMLElement;
  let hint: HTMLElement;
  let mine: HTMLElement;
  let join: HTMLButtonElement;
  let invite: HTMLButtonElement;
  let reset: HTMLButtonElement;
  let sceneEl: HTMLElement;
  let feed: HTMLElement;
  let tip: HTMLElement;
  let sceneHint: HTMLElement;
  let banner: HTMLElement;
  try {
    price = must('[data-price]');
    count = must('[data-count]');
    fill = must('[data-fill]');
    hint = must('[data-hint]');
    mine = must('[data-mine]');
    join = must<HTMLButtonElement>('[data-join]');
    invite = must<HTMLButtonElement>('[data-invite]');
    reset = must<HTMLButtonElement>('[data-reset]');
    sceneEl = must('[data-scene]');
    feed = must('[data-feed]');
    tip = must('[data-tip]');
    sceneHint = must('[data-scene-hint]');
    banner = must('[data-unlock]');
  } catch (e) {
    if (e instanceof MissingPart) return;
    throw e;
  }
  const reduced = prefersReducedMotion();
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
  const track = root.querySelector<HTMLElement>('.ladder__track');
  const stars = sparkles(hint);
  const svgWindows = Array.from(root.querySelectorAll<SVGElement>('[data-w]'));

  const { tiers, unit, unitPlural, startUnits } = demoRound;
  const target = tiers[tiers.length - 1]?.units ?? 0;
  const windows = allWindows();
  const baseOrder = lightingOrder(windows.length);
  let order = baseOrder;

  let neighbours = startUnits;
  let myUnits = 0;
  let building: Building | null = null;
  let inviteTimer = 0;
  let unlockTimer = 0;
  let bannerTimer = 0;
  let tipTimer = 0;

  const units = () => neighbours + myUnits;
  const noun = (n: number) => (n === 1 ? unit : unitPlural);
  const lit = () => litSet(order, units());

  // ---- the price counts to its new value (after a chip lands, when one is flying) ----------
  let shown = priceFor(tiers, units());
  let priceRaf = 0;
  let priceTimer = 0;
  function tweenPrice(to: number, delay: number) {
    clearTimeout(priceTimer);
    cancelAnimationFrame(priceRaf);
    if (reduced || to === shown) {
      shown = to;
      price.textContent = rupees(to);
      return;
    }
    priceTimer = window.setTimeout(() => {
      const from = shown;
      const start = performance.now();
      const dur = 650;
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        shown = Math.round(from + (to - from) * e);
        price.textContent = rupees(shown);
        if (k < 1) priceRaf = requestAnimationFrame(step);
        else shown = to;
      };
      priceRaf = requestAnimationFrame(step);
    }, delay);
  }

  function restart(el: HTMLElement, cls: string) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function render(before: number, priceDelay = 0) {
    const u = units();
    const p = priceFor(tiers, u);
    const isUnlock = unlocked(tiers, before, u);
    tweenPrice(p, priceDelay);
    count.textContent = `${u} of ${target} ${unitPlural}`;
    const progress = ladderProgress(tiers, u);
    fill.style.width = `${Math.round(progress * 100)}%`;
    sceneEl.style.setProperty('--progress', progress.toFixed(3));
    const idx = tierIndex(tiers, u);
    steps.forEach((s, i) => {
      s.classList.toggle('is-reached', i <= idx);
      s.classList.toggle('is-current', i === idx);
    });
    const next = nextTier(tiers, u);
    if (next) {
      const more = next.units - u;
      hint.textContent = `${more} more ${noun(more)} to unlock ${rupees(next.price)}`;
      hint.classList.remove('is-unlocked');
      stars.off();
    } else {
      hint.textContent = 'Best price unlocked for everyone';
      hint.classList.add('is-unlocked');
      stars.on();
    }
    if (myUnits > 0) {
      const save = savingPerUnit(tiers, u) * myUnits;
      mine.textContent = save > 0 ? `You save ${rupees(save)} on ${myUnits} ${noun(myUnits)}` : `You are in with ${myUnits} ${noun(myUnits)}`;
    } else {
      mine.textContent = '';
    }
    // Joining past the target would read "12 of 10"; the demo stops at the best price.
    join.disabled = myUnits > 0 || u + MY_UNITS > target;
    join.textContent = myUnits > 0 ? `You're in with ${myUnits} ${noun(myUnits)}` : `Join with ${MY_UNITS} ${noun(MY_UNITS)}`;
    invite.disabled = !next;
    reset.hidden = u === startUnits && myUnits === 0;

    const on = lit();
    svgWindows.forEach((w) => w.classList.toggle('lit', on.has(Number(w.getAttribute('data-w')))));
    building?.setOrder(order);
    building?.setUnits(u);

    if (isUnlock) {
      // The celebration lands with the chip, on the new price (V2 P3-4).
      clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => {
        building?.burst();
        restart(price, 'flash');
        if (track) restart(track, 'is-unlock');
        banner.textContent = `${rupees(p)} unlocked for everyone`;
        restart(banner, 'is-on');
        // Reduced motion has no keyframes to fade it: the class itself shows it (V2 P3-1).
        clearTimeout(bannerTimer);
        bannerTimer = window.setTimeout(() => banner.classList.remove('is-on'), 2300);
      }, priceDelay);
    }
  }

  // ---- where a window is, in the hero's own coordinates -----------------------------------
  function windowPoint(index: number): { x: number; y: number } {
    const r = root.getBoundingClientRect();
    const s = sceneEl.getBoundingClientRect();
    const p = building?.project(index);
    if (p) return { x: s.left - r.left + p.x, y: s.top - r.top + p.y };
    const el = svgWindows.find((w) => w.getAttribute('data-w') === String(index));
    const b = el?.getBoundingClientRect();
    if (b && b.width > 0) return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 };
    return { x: s.left - r.left + s.width / 2, y: s.top - r.top + s.height * 0.4 };
  }

  /** "+N": rises off the window, then falls onto the price — x eases evenly, y on a curve. */
  function flyChip(index: number, text: string): number {
    if (reduced) return 0;
    const from = windowPoint(index);
    const r = root.getBoundingClientRect();
    const pr = price.getBoundingClientRect();
    const to = { x: pr.left - r.left + pr.width / 2, y: pr.top - r.top + pr.height / 2 };
    const outer = document.createElement('span');
    outer.className = 'fly';
    outer.setAttribute('aria-hidden', 'true');
    outer.style.left = `${from.x}px`;
    outer.style.top = `${from.y}px`;
    const chip = document.createElement('span');
    chip.className = 'fly__chip figure';
    chip.textContent = text;
    outer.appendChild(chip);
    root.appendChild(outer);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], {
      duration: FLIGHT,
      easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
      fill: 'forwards',
    });
    const lift = -Math.min(70, 30 + Math.abs(dx) * 0.08);
    const flight = chip.animate(
      [
        { transform: 'translate(-50%, -50%) translateY(0) scale(0.4)', opacity: 0, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
        { transform: `translate(-50%, -50%) translateY(${lift}px) scale(1.05)`, opacity: 1, offset: 0.3, easing: 'cubic-bezier(0.55, 0, 0.9, 0.45)' },
        { transform: `translate(-50%, -50%) translateY(${dy}px) scale(0.6)`, opacity: 0.85 },
      ],
      { duration: FLIGHT, fill: 'forwards' },
    );
    flight.onfinish = () => {
      outer.remove();
      restart(price, 'tick');
    };
    return FLIGHT - 120;
  }

  function pushFeed(who: string, what: string, isMine = false) {
    const li = document.createElement('li');
    li.className = `feed__item${isMine ? ' is-mine' : ''}`;
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    const strong = document.createElement('strong');
    strong.textContent = who;
    const span = document.createElement('span');
    span.textContent = what;
    li.append(dot, strong, span);
    feed.prepend(li);
    while (feed.children.length > FEED_MAX) feed.lastElementChild?.remove();
  }

  /** One neighbour joins with one unit: the tapped flat, or the next one in the order. */
  function addNeighbour(at: number | null): boolean {
    const u = units();
    if (u >= target) return false;
    const litN = litCount(u, windows.length);
    const idx = at ?? order[litN];
    if (idx === undefined) return false;
    order = promote(order, litN, flatOf(windows, idx));
    neighbours += 1;
    const w = windows[idx];
    pushFeed(w ? flatLabel(w) : 'A neighbour', `joined · 1 ${unit}`);
    render(u, flyChip(idx, `+1 ${unit}`));
    return true;
  }

  // ---- autoplay: a few neighbours arrive on their own until the visitor takes over --------
  let autoTimer = 0;
  let autoStopped = reduced;
  let heroVisible = true;
  /** A tick that found the hero off-screen waits here for it to come back (V2 P3-2). */
  let autoParked = false;
  function stopAuto() {
    autoStopped = true;
    autoParked = false;
    clearTimeout(autoTimer);
  }
  function resumeAuto() {
    if (!autoParked || autoStopped || !heroVisible || document.hidden) return;
    autoParked = false;
    scheduleAuto(700);
  }
  function nudge() {
    sceneHint.textContent = 'Your turn: tap a window';
    restart(sceneHint, 'is-nudge');
  }
  function scheduleAuto(delay: number) {
    if (autoStopped) return;
    autoTimer = window.setTimeout(() => {
      if (autoStopped) return;
      if (!heroVisible || document.hidden) {
        autoParked = true;
        return;
      }
      if (units() >= AUTO_UNTIL || !addNeighbour(null)) {
        stopAuto();
        nudge();
        return;
      }
      scheduleAuto(AUTO_EVERY);
    }, delay);
  }
  // The visitor's first click, tap or key in the hero ends the autoplay for good. A finger
  // that lands on the scene to scroll the page does not (V2 P3-3): touch stops on the tap.
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') stopAuto();
  }, { capture: true });
  root.addEventListener('click', stopAuto, { capture: true });
  root.addEventListener('keydown', stopAuto, { capture: true });
  document.addEventListener('visibilitychange', resumeAuto);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      heroVisible = entries.some((e) => e.isIntersecting);
      resumeAuto();
    }, { threshold: 0.35 }).observe(sceneEl);
  }

  // ---- the hover tip and the tap (3D only; the buttons cover every other path) -------------
  function showTip(index: number | null, at: { x: number; y: number }) {
    clearTimeout(tipTimer);
    const w = index === null ? undefined : windows[index];
    if (!w || index === null) {
      tip.hidden = true;
      return;
    }
    const label = flatLabel(w);
    tip.textContent = lit().has(index) ? `${label} is in` : units() >= target ? `${label} · best price unlocked` : `${label} · tap to invite`;
    tip.style.left = `${at.x}px`;
    tip.style.top = `${at.y}px`;
    tip.hidden = false;
  }
  /** A tap's tip stays a moment, then goes (a finger has no hover to clear it; V2 P2-1). */
  function tapTip(index: number, at: { x: number; y: number }) {
    showTip(index, at);
    clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => {
      tip.hidden = true;
    }, 1600);
  }
  function onPick(index: number, at: { x: number; y: number }) {
    stopAuto();
    const w = windows[index];
    if (!w) return;
    if (lit().has(index) || units() >= target) {
      tapTip(index, at);
      restart(tip, 'is-shake');
      return;
    }
    addNeighbour(index);
    tapTip(index, at);
  }

  join.addEventListener('click', () => {
    if (myUnits > 0) return;
    const before = units();
    const litN = litCount(before, windows.length);
    myUnits = MY_UNITS;
    pushFeed('You', `joined · ${MY_UNITS} ${noun(MY_UNITS)}`, true);
    const first = order[litN];
    render(before, first === undefined ? 0 : flyChip(first, `+${MY_UNITS} ${noun(MY_UNITS)}`));
  });

  invite.addEventListener('click', () => {
    // One neighbour now, another a moment later: an invite rarely brings just one.
    addNeighbour(null);
    clearTimeout(inviteTimer);
    inviteTimer = window.setTimeout(() => {
      if (nextTier(tiers, units())) addNeighbour(null);
    }, 420);
  });

  reset.addEventListener('click', () => {
    clearTimeout(inviteTimer);
    clearTimeout(unlockTimer);
    const before = units();
    neighbours = startUnits;
    myUnits = 0;
    order = baseOrder;
    feed.replaceChildren();
    sceneHint.textContent = 'Drag to turn · tap a window';
    render(before);
  });

  render(units());
  scheduleAuto(AUTO_FIRST);

  if (hasWebGL()) {
    const load = () =>
      import('./building')
        .then(({ mountBuilding }) => {
          building = mountBuilding(sceneEl, units(), {
            flat: true,
            drift: true,
            interactive: { onPick, onHover: showTip, onDragStart: stopAuto },
          });
          building.setOrder(order);
          building.setUnits(units());
          sceneEl.classList.add('is-3d');
          // motion.ts raises the towers (GSAP intro) when it runs (`html.gsap`); otherwise here.
          document.dispatchEvent(new CustomEvent('bulk:scene-ready', { detail: { el: sceneEl, building } }));
          if (!document.documentElement.classList.contains('gsap')) window.setTimeout(() => building?.setView({ rise: 1 }), 400);
        })
        .catch(() => {
          /* the SVG stays */
        });
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 1200 });
    else window.setTimeout(load, 50);
  }
}
