/**
 * FEAT-028: the hero demo. One state (units pledged) drives the DOM ladder, the SVG fallback
 * and, when WebGL is available, the Three.js society. The arithmetic is model.ts.
 */
import { demoRound } from '../content/features';
import {
  allWindows,
  ladderProgress,
  lightingOrder,
  litSet,
  nextTier,
  priceFor,
  rupees,
  savingPerUnit,
  tierIndex,
  unlocked,
} from './model';
import type { Building } from './building';
import { sparkles } from './fx';

const MY_UNITS = 2;

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
  } catch (e) {
    if (e instanceof MissingPart) return;
    throw e;
  }
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
  const track = root.querySelector<HTMLElement>('.ladder__track');
  const stars = sparkles(hint);
  const svgWindows = Array.from(root.querySelectorAll<SVGElement>('[data-w]'));

  const { tiers, unit, unitPlural, startUnits } = demoRound;
  const target = tiers[tiers.length - 1]?.units ?? 0;
  const order = lightingOrder(allWindows().length);

  let neighbours = startUnits;
  let myUnits = 0;
  let building: Building | null = null;
  let inviteTimer = 0;

  const units = () => neighbours + myUnits;
  const noun = (n: number) => (n === 1 ? unit : unitPlural);

  function render(before: number) {
    const u = units();
    const p = priceFor(tiers, u);
    price.textContent = rupees(p);
    count.textContent = `${u} of ${target} ${unitPlural}`;
    fill.style.width = `${Math.round(ladderProgress(tiers, u) * 100)}%`;
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
    reset.hidden = u === startUnits;

    const lit = litSet(order, u);
    svgWindows.forEach((w) => w.classList.toggle('lit', lit.has(Number(w.getAttribute('data-w')))));
    building?.setUnits(u);

    if (unlocked(tiers, before, u)) {
      building?.burst();
      price.classList.remove('flash');
      void price.offsetWidth;
      price.classList.add('flash');
      if (track) {
        track.classList.remove('is-unlock');
        void track.offsetWidth;
        track.classList.add('is-unlock');
      }
    }
  }

  join.addEventListener('click', () => {
    if (myUnits > 0) return;
    const before = units();
    myUnits = MY_UNITS;
    render(before);
  });

  invite.addEventListener('click', () => {
    // One neighbour now, another a moment later: an invite rarely brings just one.
    const before = units();
    neighbours += 1;
    render(before);
    clearTimeout(inviteTimer);
    inviteTimer = window.setTimeout(() => {
      if (!nextTier(tiers, units())) return;
      const b = units();
      neighbours += 1;
      render(b);
    }, 420);
  });

  reset.addEventListener('click', () => {
    clearTimeout(inviteTimer);
    const before = units();
    neighbours = startUnits;
    myUnits = 0;
    render(before);
  });

  render(units());

  if (hasWebGL()) {
    const load = () =>
      import('./building')
        .then(({ mountBuilding }) => {
          building = mountBuilding(sceneEl, units());
          sceneEl.classList.add('is-3d');
        })
        .catch(() => {
          /* the SVG stays */
        });
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 1200 });
    else window.setTimeout(load, 50);
  }
}
