import type { Prisma, Rating, RoundParticipant } from '@prisma/client';
import type {
  AdminRoundDetailDto,
  AdminRoundParticipantDto,
  AdminRoundPaymentSummary,
  AdminRoundSummaryDto,
  RoundStatus,
} from '@bulk/shared';
import { summarise } from './ratings.mapper';
import { toServiceSummary } from './rounds.mapper';
import { computePricing } from './rounds.pricing';

/**
 * Prisma include for the super-admin round summary (FEAT-005): society, service,
 * vendor, tiers and the minimal participant fields the payment summary needs.
 */
export const adminRoundSummaryInclude = {
  society: true,
  service: true,
  vendor: true,
  tiers: { orderBy: { threshold: 'asc' } },
  participants: { select: { units: true, paymentCollectedAt: true } },
} satisfies Prisma.RoundInclude;

/**
 * Prisma include for the super-admin round detail: the summary plus every
 * participant + resident, and (FEAT-007) every rating on the round, so the admin
 * sees what each resident thought of the job in the same read.
 */
export const adminRoundDetailInclude = {
  society: true,
  service: true,
  vendor: true,
  tiers: { orderBy: { threshold: 'asc' } },
  participants: { include: { resident: true }, orderBy: { createdAt: 'asc' } },
  ratings: true,
} satisfies Prisma.RoundInclude;

export type AdminRoundSummaryRow = Prisma.RoundGetPayload<{
  include: typeof adminRoundSummaryInclude;
}>;
export type AdminRoundDetailRow = Prisma.RoundGetPayload<{
  include: typeof adminRoundDetailInclude;
}>;
export type AdminParticipantRow = Prisma.RoundParticipantGetPayload<{
  include: { resident: true };
}>;

type PaymentInput = Pick<RoundParticipant, 'units' | 'paymentCollectedAt'>;

/**
 * Payment summary for a round (ADR-0012). Amounts are `finalPrice × units` and are
 * 0 while no final price is set (no vendor assigned yet); counts are always real.
 */
export function computePaymentSummary(
  finalPrice: number | null,
  participants: readonly PaymentInput[],
): AdminRoundPaymentSummary {
  let collectedCount = 0;
  let collectedAmount = 0;
  let outstandingAmount = 0;
  for (const p of participants) {
    const amount = finalPrice === null ? 0 : finalPrice * p.units;
    if (p.paymentCollectedAt !== null) {
      collectedCount += 1;
      collectedAmount += amount;
    } else {
      outstandingAmount += amount;
    }
  }
  return {
    participantsCount: participants.length,
    collectedCount,
    collectedAmount,
    outstandingAmount,
  };
}

/** Shape a loaded round (summary or detail include) into {@link AdminRoundSummaryDto}. */
export function buildAdminRoundSummary(
  round: AdminRoundSummaryRow | AdminRoundDetailRow,
): AdminRoundSummaryDto {
  const tiers = round.tiers.map((t) => ({ threshold: t.threshold, price: t.price }));
  const pricing = computePricing(tiers, round.unitsCount);
  return {
    id: round.id,
    status: round.status as RoundStatus,
    society: { id: round.society.id, name: round.society.name, city: round.society.city },
    service: toServiceSummary(round.service),
    unitsCount: round.unitsCount,
    participantsCount: round.participants.length,
    currentPrice: pricing.currentPrice,
    ...(pricing.nextTier ? { nextTier: pricing.nextTier } : {}),
    tiers: pricing.tiers,
    deadline: round.deadline.toISOString(),
    createdAt: round.createdAt.toISOString(),
    vendor: round.vendor
      ? { id: round.vendor.id, name: round.vendor.name, phone: round.vendor.phone }
      : null,
    finalPrice: round.finalPrice,
    assignedAt: round.assignedAt?.toISOString() ?? null,
    deliveredAt: round.deliveredAt?.toISOString() ?? null,
    payments: computePaymentSummary(round.finalPrice, round.participants),
  };
}

/**
 * Shape one participant for the admin (includes resident PII: SUPER_ADMIN routes only).
 * `rating` is this resident's own rating of the round, or null (FEAT-007).
 */
export function buildAdminParticipant(
  participant: AdminParticipantRow,
  finalPrice: number | null,
  rating?: Rating | null,
): AdminRoundParticipantDto {
  return {
    id: participant.id,
    resident: {
      id: participant.resident.id,
      name: participant.resident.name,
      phone: participant.resident.phone,
    },
    units: participant.units,
    amountDue: finalPrice === null ? null : finalPrice * participant.units,
    paymentCollected: participant.paymentCollectedAt !== null,
    paymentCollectedAt: participant.paymentCollectedAt?.toISOString() ?? null,
    joinedAt: participant.createdAt.toISOString(),
    rating: rating
      ? {
          stars: rating.stars,
          comment: rating.comment,
          ratedAt: rating.updatedAt.toISOString(),
        }
      : null,
  };
}

/** Shape a loaded round with participants + ratings into {@link AdminRoundDetailDto}. */
export function buildAdminRoundDetail(round: AdminRoundDetailRow): AdminRoundDetailDto {
  const byResident = new Map(round.ratings.map((r) => [r.residentId, r]));
  return {
    ...buildAdminRoundSummary(round),
    participants: round.participants.map((p) =>
      buildAdminParticipant(p, round.finalPrice, byResident.get(p.residentId) ?? null),
    ),
    ratings: summarise(round.ratings.map((r) => r.stars)),
  };
}
