/**
 * FEAT-028 T5c: the scroll story. One number — progress 0..1 through the "How a group buy
 * works" section — maps to everything the sticky scene shows: which step is current, how
 * many units are pledged, where the camera is, whether the towers have risen, and whether
 * the deadline has just closed the round. Pure, so it is unit-tested; motion.ts feeds it
 * from GSAP's ScrollTrigger, the scene reads it.
 */
import { demoRound } from '../content/features';
import { priceFor } from './model';

export interface View {
  /** Orbit around the society, radians, added to the idle sway. */
  yaw: number;
  /** Tilt, radians (negative looks down a little more). */
  pitch: number;
  /** 1 = the resting camera; >1 moves closer. */
  zoom: number;
  /** 0 = towers flat on the plot, 1 = standing. */
  rise: number;
}

export interface StoryState {
  step: 0 | 1 | 2 | 3;
  units: number;
  price: number;
  view: View;
  /** True only inside the short window after the deadline closes the round. */
  closed: boolean;
  /** 0..1 through the current step, for captions. */
  stepProgress: number;
}

export const STEPS = 4;
const { tiers, startUnits } = demoRound;
const target = tiers[tiers.length - 1]?.units ?? 10;
const MY_UNITS = 2;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** The step and how far into it we are. */
export const stepAt = (progress: number): { step: 0 | 1 | 2 | 3; k: number } => {
  const p = clamp01(progress) * STEPS;
  const step = Math.min(STEPS - 1, Math.floor(p)) as 0 | 1 | 2 | 3;
  return { step, k: clamp01(p - step) };
};

/**
 * Step 0 — the operator opens a round: the towers rise from the plot, the camera is high and
 *          far; a few neighbours are already in.
 * Step 1 — you pledge: the camera comes in and swings to the front; your flats light.
 * Step 2 — neighbours join: the society fills to the target while the camera orbits.
 * Step 3 — the deadline closes it: a last swing, the burst at the start, then rest.
 */
export const storyAt = (progress: number): StoryState => {
  const { step, k } = stepAt(progress);
  let units = startUnits;
  let view: View = { yaw: 0.55, pitch: -0.22, zoom: 0.82, rise: 1 };
  let closed = false;
  switch (step) {
    case 0: {
      const r = easeOut(clamp01(k * 1.6));
      view = { yaw: lerp(0.9, 0.55, r), pitch: lerp(-0.3, -0.22, r), zoom: lerp(0.7, 0.82, r), rise: r };
      units = k > 0.75 ? startUnits : 0;
      break;
    }
    case 1: {
      const r = easeInOut(k);
      view = { yaw: lerp(0.55, 0.1, r), pitch: lerp(-0.22, -0.08, r), zoom: lerp(0.82, 1.25, r), rise: 1 };
      units = k > 0.45 ? startUnits + MY_UNITS : startUnits;
      break;
    }
    case 2: {
      const r = easeInOut(k);
      view = { yaw: lerp(0.1, -0.5, r), pitch: lerp(-0.08, -0.16, r), zoom: lerp(1.25, 1.0, r), rise: 1 };
      units = Math.round(lerp(startUnits + MY_UNITS, target, easeOut(k)));
      break;
    }
    case 3: {
      const r = easeInOut(k);
      view = { yaw: lerp(-0.5, -0.85, r), pitch: lerp(-0.16, -0.2, r), zoom: lerp(1.0, 0.9, r), rise: 1 };
      units = target + 1;
      closed = k > 0.05 && k < 0.35;
      break;
    }
  }
  return { step, units, price: priceFor(tiers, units), view, closed, stepProgress: k };
};
