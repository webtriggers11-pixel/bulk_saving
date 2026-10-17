import type { Round, RoundParticipant, RoundTier, Service } from '@prisma/client';
import { buildRoundDto, type RoundWithView } from './rounds.mapper';

/**
 * BUG-010: the resident view of a round must carry the NEGOTIATED price once the admin
 * has set one. A delivered AC round negotiated at ₹680 told the resident ₹900 — the tier
 * price it had reached while open — because the resident DTO had no `finalPrice` at all.
 */
const service = {
  id: 'svc', name: 'AC Servicing', slug: 'ac-servicing', description: '', category: 'Appliances',
  imageUrl: null, active: true, unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null,
  createdAt: new Date(), updatedAt: new Date(),
} as Service;

function round(overrides: Partial<Round>): RoundWithView {
  return {
    id: 'r1', societyId: 's', serviceId: 'svc', status: 'OPEN', unitsCount: 11,
    deadline: new Date('2026-10-01T00:00:00Z'), createdAt: new Date(), updatedAt: new Date(),
    vendorId: null, finalPrice: null, assignedAt: null, deliveredAt: null,
    ...overrides,
    service,
    tiers: [
      { id: 't1', roundId: 'r1', threshold: 5, price: 900 },
      { id: 't2', roundId: 'r1', threshold: 10, price: 700 },
    ] as RoundTier[],
    participants: [{ units: 3 } as RoundParticipant],
  };
}

describe('buildRoundDto — final price (BUG-010)', () => {
  it('carries the negotiated price once one is set, beside the tier price', () => {
    const dto = buildRoundDto(round({ status: 'DELIVERED', vendorId: 'v', finalPrice: 680 }));
    expect(dto.finalPrice).toBe(680);
    expect(dto.currentPrice).toBe(700);
  });

  it('is null — not absent, not the tier price — before a price is negotiated', () => {
    expect(buildRoundDto(round({ status: 'OPEN' })).finalPrice).toBeNull();
  });
});
