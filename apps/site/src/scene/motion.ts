/**
 * FEAT-028 T5c: the cinematic layer — GSAP 3.15 (ScrollTrigger, SplitText; all free since
 * Webflow) over a Lenis smooth scroll, wired the way both libraries document it: Lenis tells
 * ScrollTrigger when it scrolled, GSAP's ticker drives Lenis, lag smoothing off. Everything
 * is declared inside gsap.matchMedia so a reduced-motion preference gets final states and
 * no scrub; Lenis itself drops smoothing under that preference.
 *
 * What it animates:
 *  - the hero entrance (SplitText characters, then the rest, then the towers rising),
 *  - the scroll story in "How a group buy works": a sticky second scene, scrubbed by
 *    progress through story.ts (camera orbit and zoom, towers rising, windows filling, the
 *    price in the HUD, a burst when the deadline closes), captions lit per step,
 *  - section headings (SplitText words), feature rows (batched stagger), phone mocks
 *    (gentle parallax).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import type { Building } from './building';
import { rupees } from './model';
import { storyAt } from './story';
import { prefersReducedMotion } from './theme';

gsap.registerPlugin(ScrollTrigger, SplitText);

const REDUCE = '(prefers-reduced-motion: reduce)';
const MOTION = '(prefers-reduced-motion: no-preference)';

let lenis: Lenis | null = null;

const mountLenis = () => {
  if (lenis) return lenis;
  lenis = new Lenis({ lerp: 0.1, anchors: { offset: -72 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  // Dev builds expose the instance so a browser pass can drive the scroll (Lenis owns
  // programmatic scrolling); the condition folds away in production.
  if (import.meta.env.DEV) (window as Window & { bulkLenis?: Lenis }).bulkLenis = lenis;
  return lenis;
};

/** The hero: characters rise through a blur, then the copy, then the towers stand up. */
const heroIntro = (reduced: boolean) => {
  const title = document.querySelector<HTMLElement>('#hero-title');
  const copy = Array.from(document.querySelectorAll<HTMLElement>('.hero__copy > :not(h1)'));
  const demo = document.querySelector<HTMLElement>('[data-hero]');
  if (!title) return;
  if (reduced) {
    gsap.set([title, ...copy, demo], { clearProps: 'all', opacity: 1 });
    return;
  }
  const split = SplitText.create(title, { type: 'chars,words', charsClass: 'char', wordsClass: 'word' });
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.from(split.chars, { yPercent: 110, opacity: 0, filter: 'blur(8px)', duration: 0.9, stagger: { each: 0.018, from: 'start' } })
    .from(copy, { y: 18, opacity: 0, duration: 0.7, stagger: 0.08 }, '-=0.55')
    .from(demo, { y: 26, opacity: 0, scale: 0.98, duration: 0.9, ease: 'power2.out' }, '-=0.6');
  // The towers rise once the scene has mounted (hero.ts announces it); if it already has, now.
  const raise = (b: Building) => {
    const v = { rise: 0 };
    gsap.to(v, { rise: 1, duration: 1.6, ease: 'expo.out', delay: 0.35, onUpdate: () => b.setView({ rise: v.rise }) });
  };
  const ready = (e: Event) => raise((e as CustomEvent<{ building: Building }>).detail.building);
  document.addEventListener('bulk:scene-ready', ready, { once: true });
};

/** "How a group buy works": the sticky scene scrubbed by scroll through story.ts. */
const storySection = (reduced: boolean) => {
  const section = document.querySelector<HTMLElement>('[data-story]');
  if (!section) return;
  const sceneEl = section.querySelector<HTMLElement>('[data-story-scene]');
  const steps = Array.from(section.querySelectorAll<HTMLElement>('[data-story-step]'));
  const hudPrice = section.querySelector<HTMLElement>('[data-hud-price]');
  const hudUnits = section.querySelector<HTMLElement>('[data-hud-units]');
  const hudState = section.querySelector<HTMLElement>('[data-hud-state]');
  const hudFill = section.querySelector<HTMLElement>('[data-hud-fill]');
  if (!sceneEl || !steps.length) return;

  let building: Building | null = null;
  let lastStep = -1;
  let lastClosed = false;
  const target = Number(section.dataset.storyTarget ?? 10);

  const apply = (progress: number) => {
    const s = storyAt(progress);
    building?.setView(s.view);
    building?.setUnits(s.units);
    if (hudPrice) hudPrice.textContent = rupees(s.price);
    if (hudUnits) hudUnits.textContent = `${Math.min(s.units, target)} of ${target}`;
    if (hudFill) hudFill.style.width = `${Math.min(100, (s.units / target) * 100)}%`;
    if (hudState) {
      hudState.textContent = s.step === 3 ? (s.stepProgress > 0.05 ? 'Closed · met' : 'Closing…') : s.step === 0 && s.stepProgress < 0.75 ? 'Opening' : 'Open';
      hudState.classList.toggle('is-closed', s.step === 3 && s.stepProgress > 0.05);
    }
    if (s.step !== lastStep) {
      steps.forEach((el, i) => el.classList.toggle('is-current', i === s.step));
      steps.forEach((el, i) => el.classList.toggle('is-past', i < s.step));
      lastStep = s.step;
    }
    if (s.closed && !lastClosed) building?.burst();
    lastClosed = s.closed;
  };

  // The scene mounts when the story is near; the first paint is the state at the top.
  const mount = () =>
    import('./building').then(({ mountBuilding }) => {
      if (building) return;
      building = mountBuilding(sceneEl, 0, { flat: true });
      sceneEl.classList.add('is-3d');
      apply(reduced ? 1 : 0);
    });
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        void mount();
      }
    },
    { rootMargin: '600px 0px' },
  );
  io.observe(section);

  if (reduced) {
    // No scrub: each caption, as it enters, sets the state for its step.
    steps.forEach((el, i) => {
      ScrollTrigger.create({ trigger: el, start: () => (innerWidth < 900 ? 'top 85%' : 'top 70%'), onEnter: () => apply((i + 0.9) / steps.length), onEnterBack: () => apply((i + 0.9) / steps.length) });
    });
    return;
  }
  const progress = { p: 0 };
  gsap.to(progress, {
    p: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: section.querySelector('[data-story-track]') ?? section,
      // Desktop: captions sit beside the sticky scene, so the window is the middle of the
      // viewport. Phone: the sticky stage holds the top ~45%, captions pass beneath it.
      start: () => (innerWidth < 900 ? 'top 92%' : 'top 20%'),
      end: () => (innerWidth < 900 ? 'bottom 98%' : 'bottom 80%'),
      invalidateOnRefresh: true,
      scrub: 0.6,
      onUpdate: () => apply(progress.p),
    },
  });
};

/** Section headings split into words that rise; feature rows stagger in; mocks drift. */
const reveals = (reduced: boolean) => {
  const heads = Array.from(document.querySelectorAll<HTMLElement>('.section__head h2'));
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.feat, .step, .msg, .tile, .pack'));
  const mocks = Array.from(document.querySelectorAll<HTMLElement>('.phone'));
  if (reduced) {
    gsap.set([...heads, ...rows, ...mocks], { clearProps: 'all', opacity: 1 });
    return;
  }
  heads.forEach((h) => {
    const split = SplitText.create(h, { type: 'words', wordsClass: 'word' });
    gsap.from(split.words, {
      yPercent: 100,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.04,
      scrollTrigger: { trigger: h, start: 'top 85%', once: true },
    });
  });
  ScrollTrigger.batch(rows, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.from(batch, { y: 22, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, overwrite: true }),
  });
  mocks.forEach((m) => {
    gsap.fromTo(m, { y: 40 }, { y: -40, ease: 'none', scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
  });
};

export const mountMotion = () => {
  document.documentElement.classList.add('gsap');
  if (!prefersReducedMotion()) mountLenis();
  const mm = gsap.matchMedia();
  mm.add(MOTION, () => {
    heroIntro(false);
    storySection(false);
    reveals(false);
  });
  mm.add(REDUCE, () => {
    heroIntro(true);
    storySection(true);
    reveals(true);
  });
  // Fonts settle after first paint; measurements for pins and splits must follow.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
};
