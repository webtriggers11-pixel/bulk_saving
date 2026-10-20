/**
 * FEAT-028 T5d: the catalog wall's arithmetic, pure. Filtering by chip and query (the app's
 * server filters, FEAT-015, mirrored client-side for the demo), the countdown wording, the
 * ask toggle (FEAT-022), and the pledge sheet's totals (FEAT-003/010).
 */
import type { CatalogItem, Category } from '../content/features';
import { nextTier, priceFor } from './model';

export interface Filter {
  category: Category | 'all';
  q: string;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** The items that match: category first, then a case-insensitive name search (≤ 80 chars). */
export const filterCatalog = <T extends Pick<CatalogItem, 'name' | 'category'>>(items: readonly T[], f: Filter): T[] => {
  const q = norm(f.q).slice(0, 80);
  return items.filter((it) => (f.category === 'all' || it.category === f.category) && (!q || norm(it.name).includes(q)));
};

/** "closes in 2d 4h", "closes in 5h", "closes in 40m", "closing now". */
export const closesIn = (hoursLeft: number): string => {
  const mins = Math.max(0, Math.round(hoursLeft * 60));
  if (mins === 0) return 'closing now';
  const d = Math.floor(mins / (24 * 60));
  const h = Math.floor((mins % (24 * 60)) / 60);
  const m = mins % 60;
  if (d > 0) return `closes in ${d}d${h > 0 ? ` ${h}h` : ''}`;
  if (h > 0) return `closes in ${h}h${m > 0 && h < 6 ? ` ${m}m` : ''}`;
  return `closes in ${m}m`;
};

/** Toggling your ask: the count moves by one, never below zero. */
export const toggleAsk = (count: number, asked: boolean): { count: number; asked: boolean } =>
  asked ? { count: Math.max(0, count - 1), asked: false } : { count: count + 1, asked: true };

export const askLabel = (count: number, asked: boolean): string => {
  if (count === 0) return 'No one has asked yet';
  if (asked) return count === 1 ? 'You asked' : `You and ${count - 1} ${count - 1 === 1 ? 'neighbour' : 'neighbours'} asked`;
  return `${count} ${count === 1 ? 'neighbour' : 'neighbours'} asked`;
};

export interface SheetState {
  units: number;
  priceNow: number;
  total: number;
  hint: string;
}

/** The pledge sheet for `units` of your own on top of the round's pledged count. */
export const sheetFor = (round: NonNullable<CatalogItem['round']>, units: number, unitNoun: { one: string; many: string }): SheetState => {
  const u = Math.max(1, Math.min(9, Math.round(units)));
  const after = round.pledged + u;
  const priceNow = priceFor(round.tiers, after);
  const next = nextTier(round.tiers, after);
  const more = next ? next.units - after : 0;
  const hint = next
    ? `${more} more ${more === 1 ? unitNoun.one : unitNoun.many} ${more === 1 ? 'unlocks' : 'unlock'} ₹${next.price.toLocaleString('en-IN')} for everyone`
    : 'Best price unlocked for everyone';
  return { units: u, priceNow, total: priceNow * u, hint };
};
