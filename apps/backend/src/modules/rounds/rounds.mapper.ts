import type { Round, RoundParticipant, RoundTier, Service } from '@prisma/client';
import type { RoundDto, RoundServiceSummary, RoundStatus } from '@bulk/shared';
import { computePricing } from './rounds.pricing';

/**
 * A round loaded with everything the resident view needs: its service, its
 * tiers, and the CALLER'S own participation (0 or 1 row — the query filters
 * participants to the caller so `myUnits` never leaks other residents' pledges).
 */
export type RoundWithView = Round & {
  service: Service;
  tiers: RoundTier[];
  participants: RoundParticipant[];
};

/** Compact service summary embedded in a round view. */
export function toServiceSummary(service: Service): RoundServiceSummary {
  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    category: service.category,
    // FEAT-010: every screen that shows a count needs the word for it, and every
    // round DTO already embeds this summary — so no screen needs a second request.
    unitLabel: service.unitLabel,
    unitLabelPlural: service.unitLabelPlural,
    unitDescription: service.unitDescription,
    ...(service.imageUrl !== null ? { imageUrl: service.imageUrl } : {}),
  };
}

/**
 * Shape a loaded round into the resident-facing {@link RoundDto}, computing the
 * current price / next tier from the authoritative `unitsCount` and folding in
 * the caller's own pledged units.
 */
export function buildRoundDto(round: RoundWithView): RoundDto {
  const tiers = round.tiers.map((t) => ({ threshold: t.threshold, price: t.price }));
  const pricing = computePricing(tiers, round.unitsCount);
  const myUnits = round.participants[0]?.units ?? 0;

  return {
    id: round.id,
    service: toServiceSummary(round.service),
    status: round.status as RoundStatus,
    unitsCount: round.unitsCount,
    currentPrice: pricing.currentPrice,
    ...(pricing.nextTier ? { nextTier: pricing.nextTier } : {}),
    deadline: round.deadline.toISOString(),
    tiers: pricing.tiers,
    myUnits,
    // BUG-010: the negotiated price, so the resident sees what they actually owe.
    finalPrice: round.finalPrice,
  };
}
