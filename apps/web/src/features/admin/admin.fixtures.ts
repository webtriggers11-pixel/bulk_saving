import type {
  AdminDashboardDto,
  AdminRoundDetailDto,
  AdminRoundSummaryDto,
  AdminSocietyDto,
  ResidentDto,
  VendorDto,
} from '@bulk/shared';

/** Test fixtures for the admin feature tests (never imported by app code). */

export const society: AdminSocietyDto = {
  id: 'soc_1',
  name: 'Green Park',
  city: 'Pune',
  inviteCode: 'GREEN1',
};

export const roundSummary: AdminRoundSummaryDto = {
  id: 'round_1',
  status: 'OPEN',
  society: { id: 'soc_1', name: 'Green Park', city: 'Pune' },
  service: { id: 'svc_1', name: 'AC Servicing', slug: 'ac-servicing', category: 'Appliances', unitLabel: 'AC unit', unitLabelPlural: 'AC units', unitDescription: null },
  unitsCount: 6,
  participantsCount: 2,
  currentPrice: 900,
  nextTier: { threshold: 10, price: 700 },
  tiers: [
    { threshold: 5, price: 900 },
    { threshold: 10, price: 700 },
  ],
  deadline: '2026-09-24T12:00:00.000Z',
  createdAt: '2026-09-17T10:00:00.000Z',
  vendor: null,
  finalPrice: null,
  assignedAt: null,
  deliveredAt: null,
  payments: { participantsCount: 2, collectedCount: 0, collectedAmount: 0, outstandingAmount: 0 },
};

export function roundDetail(overrides: Partial<AdminRoundDetailDto> = {}): AdminRoundDetailDto {
  return {
    ...roundSummary,
    participants: [
      {
        id: 'p_1',
        resident: { id: 'res_1', name: 'Asha', phone: '+919800000001' },
        units: 4,
        amountDue: null,
        paymentCollected: false,
        paymentCollectedAt: null,
        joinedAt: '2026-09-17T11:00:00.000Z',
        rating: null,
      },
      {
        id: 'p_2',
        resident: { id: 'res_2', name: null, phone: '+919800000002' },
        units: 2,
        amountDue: null,
        paymentCollected: false,
        paymentCollectedAt: null,
        joinedAt: '2026-09-17T12:00:00.000Z',
        rating: null,
      },
    ],
    ratings: { average: null, count: 0 },
    ...overrides,
  };
}

/** An ASSIGNED round with a vendor, final price, and one participant already paid. */
export function assignedRoundDetail(): AdminRoundDetailDto {
  const base = roundDetail();
  return {
    ...base,
    status: 'ASSIGNED',
    vendor: { id: 'ven_1', name: 'CoolFix', phone: '+919811111111' },
    finalPrice: 800,
    assignedAt: '2026-09-25T09:00:00.000Z',
    payments: { participantsCount: 2, collectedCount: 1, collectedAmount: 1600, outstandingAmount: 3200 },
    participants: [
      { ...base.participants[0], amountDue: 3200 },
      {
        ...base.participants[1],
        amountDue: 1600,
        paymentCollected: true,
        paymentCollectedAt: '2026-09-26T09:00:00.000Z',
      },
    ],
  };
}

export const activeVendor: VendorDto = {
  id: 'ven_1',
  name: 'CoolFix',
  phone: '+919811111111',
  category: 'Appliances',
  notes: null,
  active: true,
  createdAt: '2026-09-17T10:00:00.000Z',
  updatedAt: '2026-09-17T10:00:00.000Z',
  averageRating: null,
  ratingCount: 0,
};

export const inactiveVendor: VendorDto = {
  ...activeVendor,
  id: 'ven_2',
  name: 'OldCo',
  active: false,
};

export const dashboard: AdminDashboardDto = {
  statusCounts: {
    OPEN: 3,
    CLOSED_MET: 2,
    CLOSED_EXPIRED: 1,
    ASSIGNED: 4,
    DELIVERED: 5,
    RATED: 0,
    CANCELLED: 1,
  },
  demandBySociety: [
    {
      society: { id: 'soc_1', name: 'Green Park', city: 'Pune' },
      openRounds: 3,
      unitsPledged: 42,
      residentsJoined: 17,
    },
  ],
  payments: { collectedAmount: 12000, outstandingAmount: 4500 },
  ratings: { average: 4.5, count: 8 },
};

export function resident(role: ResidentDto['role']): ResidentDto {
  return {
    id: 'res_admin',
    societyId: 'soc_1',
    phone: '+919800000009',
    name: 'Founder',
    role,
    verifiedAt: '2026-09-16T10:00:00.000Z',
    createdAt: '2026-09-16T10:00:00.000Z',
  };
}
