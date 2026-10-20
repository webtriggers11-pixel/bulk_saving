/**
 * FEAT-027 (ADR-0038 §4): the demo round's arithmetic, pure so it is unit-tested and shared by
 * the Three.js building, the SVG fallback and the ladder in the DOM. Mirrors the app's rule
 * (ADR-0010): the price is that of the highest tier whose unit threshold is met.
 */

export interface Tier {
  units: number;
  price: number;
}

/** Index of the highest tier reached; -1 below the first threshold. */
export const tierIndex = (tiers: readonly Tier[], units: number): number => {
  let idx = -1;
  tiers.forEach((t, i) => {
    if (units >= t.units) idx = i;
  });
  return idx;
};

/** The price per unit at this count. Below the first tier the single price (tier 0) applies. */
export const priceFor = (tiers: readonly Tier[], units: number): number => {
  const first = tiers[0];
  if (!first) throw new Error('a round needs at least one tier');
  const idx = tierIndex(tiers, units);
  return (idx < 0 ? first : tiers[idx] ?? first).price;
};

/** The next tier to unlock, or null when the best price is reached. */
export const nextTier = (tiers: readonly Tier[], units: number): Tier | null =>
  tiers.find((t) => t.units > units) ?? null;

/** True when going from `before` to `after` units crosses into a higher tier. */
export const unlocked = (tiers: readonly Tier[], before: number, after: number): boolean =>
  tierIndex(tiers, after) > tierIndex(tiers, before);

/** How far the live count is along the ladder, 0..1, for the fill. */
export const ladderProgress = (tiers: readonly Tier[], units: number): number => {
  const last = tiers[tiers.length - 1];
  if (!last || last.units <= 0) return 0;
  return Math.max(0, Math.min(1, units / last.units));
};

/** What one resident saves per unit versus the single price at this count. */
export const savingPerUnit = (tiers: readonly Tier[], units: number): number => {
  const first = tiers[0];
  if (!first) return 0;
  return first.price - priceFor(tiers, units);
};

/** Indian grouping: 1000 → "1,000", 125000 → "1,25,000". */
export const rupees = (n: number): string => {
  const s = Math.round(Math.abs(n)).toString();
  if (s.length <= 3) return `₹${s}`;
  const head = s.slice(0, -3);
  const tail = s.slice(-3);
  const grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}₹${grouped},${tail}`;
};

/* ---- the society: towers of flats; a pledge lights a flat's windows ---------------------- */

export interface Tower {
  /** Floors above the ground floor. */
  floors: number;
  /** Windows per face per floor. */
  perFace: number;
  /** Width, depth in scene units; height follows the floors. */
  width: number;
  depth: number;
  /** Position of the tower's centre on the ground. */
  x: number;
  z: number;
}

export const SOCIETY: readonly Tower[] = [
  { floors: 8, perFace: 4, width: 2.4, depth: 2.4, x: -1.1, z: 0.3 },
  { floors: 5, perFace: 3, width: 1.9, depth: 1.9, x: 1.75, z: -0.9 },
];

export const FLOOR_HEIGHT = 0.52;

/** The two faces the camera sees: +z (front) and +x (side). */
export type Face = 'front' | 'side';

export interface Win {
  tower: number;
  face: Face;
  floor: number;
  col: number;
}

/** Every visible window, in a stable order. */
export const allWindows = (towers: readonly Tower[] = SOCIETY): Win[] => {
  const out: Win[] = [];
  towers.forEach((t, tower) => {
    for (let floor = 0; floor < t.floors; floor++) {
      for (let col = 0; col < t.perFace; col++) {
        out.push({ tower, face: 'front', floor, col });
        out.push({ tower, face: 'side', floor, col });
      }
    }
  });
  return out;
};

/** One pledged unit lights this many windows (a flat). */
export const WINDOWS_PER_UNIT = 3;

/**
 * The order windows light in: a seeded shuffle so pledges scatter across the society like
 * real neighbours rather than filling floor by floor. Deterministic for a given seed, so the
 * SVG fallback and the 3D scene agree.
 */
export const lightingOrder = (count: number, seed = 7): number[] => {
  const order = Array.from({ length: count }, (_, i) => i);
  let s = seed >>> 0;
  const rand = () => {
    // LCG (Numerical Recipes); plenty for a shuffle.
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = order[i] as number;
    order[i] = order[j] as number;
    order[j] = a;
  }
  return order;
};

/** How many windows are lit at this many units (capped at the society's size). */
export const litCount = (units: number, total: number): number =>
  Math.max(0, Math.min(total, units * WINDOWS_PER_UNIT));

/** Which window indices are lit, as a Set, for `units`. */
export const litSet = (order: readonly number[], units: number): Set<number> =>
  new Set(order.slice(0, litCount(units, order.length)));
