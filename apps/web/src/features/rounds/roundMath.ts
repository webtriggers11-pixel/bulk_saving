import type { RoundDto, RoundTierDto } from '@bulk/shared';
import { unitLabelFor, unitLabelPluralFor } from '../../lib/units';

/**
 * The arithmetic behind the rounds screen's ladder and summary (FEAT-018). Pure, so the
 * screen stays a rendering of these numbers and every edge case is a unit test.
 *
 * A round's tiers are price steps: reaching a tier's `threshold` units makes its `price`
 * the price for everyone. The lowest threshold is also the round's go/no-go line
 * (ADR-0011), so below it the round has reached no tier at all.
 */

/** Tiers in the order a round climbs them: lowest threshold first. */
export function sortedTiers(round: Pick<RoundDto, 'tiers'>): RoundTierDto[] {
  return [...round.tiers].sort((a, b) => a.threshold - b.threshold);
}

/** How many tiers the live count has reached (0 = not yet at the go-ahead line). */
export function reachedTiers(round: Pick<RoundDto, 'tiers' | 'unitsCount'>): number {
  return sortedTiers(round).filter((tier) => round.unitsCount >= tier.threshold).length;
}

/** Units still needed for the next tier; 0 once the top tier is reached. */
export function unitsToNext(round: Pick<RoundDto, 'nextTier' | 'unitsCount'>): number {
  return round.nextTier ? Math.max(0, round.nextTier.threshold - round.unitsCount) : 0;
}

/**
 * Where the live count sits on the ladder, 0–100, with the steps EVENLY spaced: tiers at
 * 10 and 50 units would otherwise put the first step a fifth of the way along and make
 * the early climb look like nothing is happening. Within a step the fill is linear.
 */
export function ladderFill(round: Pick<RoundDto, 'tiers' | 'unitsCount'>): number {
  const tiers = sortedTiers(round);
  if (tiers.length === 0) return 0;
  const reached = reachedTiers(round);
  if (reached >= tiers.length) return 100;
  const from = reached === 0 ? 0 : tiers[reached - 1].threshold;
  const to = tiers[reached].threshold;
  const within = to > from ? (round.unitsCount - from) / (to - from) : 0;
  return Math.round(((reached + Math.min(1, Math.max(0, within))) / tiers.length) * 100);
}

/** The most one unit can save in this round: first-tier price minus the best tier's. */
export function maxSavingPerUnit(round: Pick<RoundDto, 'tiers'>): number {
  if (round.tiers.length === 0) return 0;
  const prices = round.tiers.map((tier) => tier.price);
  return Math.max(0, Math.max(...prices) - Math.min(...prices));
}

/** What the caller could save across the rounds they have joined, if each reaches its top tier. */
export function bestSavingForMe(rounds: Array<Pick<RoundDto, 'tiers' | 'myUnits'>>): number {
  return rounds.reduce((sum, round) => sum + maxSavingPerUnit(round) * Math.max(0, round.myUnits), 0);
}

/** "4 more AC units" / "1 more room" — in the service's own word (FEAT-010). */
export function moreUnits(count: number, round: Pick<RoundDto, 'service'>): string {
  const word = count === 1 ? unitLabelFor(round.service) : unitLabelPluralFor(round.service);
  return `${count} more ${word}`;
}
