/**
 * @bulk/shared — types shared by both apps (apps/backend and apps/web).
 * Keep this surface trivial for CHORE-001: the standard API envelope plus a
 * demo health type. Real DTOs/enums arrive with FEAT-001+.
 */

/** Error payload carried by a failed API response. */
export interface ApiError {
  code: string;
  message: string;
}

/**
 * Standard API envelope returned by every backend endpoint.
 * Success: `{ success: true, data }`. Failure: `{ success: false, error }`.
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

/** Demo payload returned by GET /health. */
export interface HealthStatus {
  status: 'ok';
  service: string;
  timestamp: string;
}

/**
 * Resident role. Mirrors the Prisma `Role` enum. Exported as a const + type so
 * both apps get a runtime value and a static type from the same name.
 */
export const Role = {
  RESIDENT: 'RESIDENT',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/**
 * Safe, client-facing view of a resident. NEVER carries internal/secret fields
 * (no OTP state, no tokens) — only what a client may see about a profile.
 */
export interface ResidentDto {
  id: string;
  societyId: string;
  phone: string;
  name: string | null;
  role: Role;
  verifiedAt: string | null;
  createdAt: string;
}

/** Minimal society view returned alongside a resident profile. */
export interface SocietyDto {
  id: string;
  name: string;
  city: string;
}

/** `POST /auth/otp/request` body. `societyId` is derived from `inviteCode`, never sent. */
export interface OtpRequestBody {
  inviteCode: string;
  phone: string;
}

/**
 * `POST /auth/otp/request` success payload.
 *
 * In every real environment this is `{ requested: true }` and NOTHING else — the OTP
 * is not returned (ADR-0007). `devCode` is a DEV-ONLY affordance (CHORE-002, ADR-0016)
 * that the API populates only when `OTP_DEV_LOG=true` AND `NODE_ENV !== 'production'`,
 * so a resident can sign in locally without reading Redis. It is OMITTED, not null,
 * whenever that guard is false — treat it as absent and never build on it.
 */
export interface OtpRequestResponse {
  requested: true;
  /** DEV ONLY. Absent outside local development. */
  devCode?: string;
}

/** `POST /auth/otp/verify` body. */
export interface OtpVerifyBody {
  inviteCode: string;
  phone: string;
  code: string;
  name?: string;
}

/** A pair of JWTs returned by verify / refresh. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** `POST /auth/otp/verify` success payload — tokens + the caller's own profile. */
export interface AuthResult extends AuthTokens {
  resident: ResidentDto;
}

/** `POST /auth/refresh` body. */
export interface RefreshBody {
  refreshToken: string;
}

/** `GET /me` success payload. */
export interface MeResponse {
  resident: ResidentDto;
  society: SocietyDto;
}

/**
 * Resident-facing view of a service available in the caller's society (FEAT-002).
 * Returned by `GET /catalog` — one entry per enabled offering ⋈ active service.
 * `indicativePrice` is display-only (integer rupees), present only when set for
 * the society's offering; it is NOT the group-buy round price (that's FEAT-003).
 */
export interface ServiceDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  imageUrl?: string;
  indicativePrice?: number;
}

/**
 * Full super-admin view of a master service (FEAT-002). Includes the moderation
 * fields (`active`, timestamps) that the resident-facing {@link ServiceDto} omits.
 */
export interface AdminServiceDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `POST /admin/services` body — create a master service. */
export interface CreateServiceBody {
  name: string;
  slug: string;
  description: string;
  category: string;
  imageUrl?: string;
}

/** `PATCH /admin/services/:id` body — update fields / toggle active (all optional). */
export interface UpdateServiceBody {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  imageUrl?: string | null;
  active?: boolean;
}

/** Super-admin view of a per-society offering (FEAT-002). */
export interface ServiceOfferingDto {
  id: string;
  societyId: string;
  serviceId: string;
  enabled: boolean;
  indicativePrice: number | null;
}

/** `PUT /admin/societies/:societyId/offerings/:serviceId` body — upsert an offering. */
export interface UpsertOfferingBody {
  enabled: boolean;
  indicativePrice?: number | null;
}

/* ---------------------------------------------------------------------------
 * Group-buy rounds (FEAT-003, ADR-0010)
 * ------------------------------------------------------------------------- */

/**
 * Round status. Mirrors the Prisma `RoundStatus` enum (FEAT-004, ADR-0011). The
 * full lifecycle: OPEN → CLOSED_MET | CLOSED_EXPIRED → ASSIGNED → DELIVERED →
 * RATED, plus CANCELLED (reachable by admin from any pre-DELIVERED state).
 * Exported as a const + type so both apps share one name.
 */
export const RoundStatus = {
  OPEN: 'OPEN',
  CLOSED_MET: 'CLOSED_MET',
  CLOSED_EXPIRED: 'CLOSED_EXPIRED',
  ASSIGNED: 'ASSIGNED',
  DELIVERED: 'DELIVERED',
  RATED: 'RATED',
  CANCELLED: 'CANCELLED',
} as const;
export type RoundStatus = (typeof RoundStatus)[keyof typeof RoundStatus];

/** One price tier of a round: `price` (integer rupees) applies once `threshold` units are pledged. */
export interface RoundTierDto {
  threshold: number;
  price: number;
}

/** Compact service summary embedded in a {@link RoundDto} (mirrors the round's service). */
export interface RoundServiceSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  imageUrl?: string;
}

/**
 * Resident-facing view of a group-buy round (`GET /rounds`, join/update/leave).
 * `currentPrice` is the price of the highest tier whose threshold is met (or the
 * lowest tier's starting price when below the first threshold). `nextTier` is the
 * next threshold to unlock, absent once the top tier is reached. `myUnits` is the
 * caller's own pledged units (0 if not joined). `deadline` is an ISO timestamp.
 */
export interface RoundDto {
  id: string;
  service: RoundServiceSummary;
  status: RoundStatus;
  unitsCount: number;
  currentPrice: number;
  nextTier?: RoundTierDto;
  deadline: string;
  tiers: RoundTierDto[];
  myUnits: number;
}

/** `POST /admin/rounds` body — open a round for a (society, service) with tiers. */
export interface CreateRoundBody {
  societyId: string;
  serviceId: string;
  deadline: string;
  tiers: RoundTierDto[];
}

/* ---------------------------------------------------------------------------
 * Post-service rating (FEAT-007, ADR-0017)
 * ------------------------------------------------------------------------- */

/** One resident's rating of one delivered round. `stars` is an integer 1–5. */
export interface RatingDto {
  id: string;
  roundId: string;
  residentId: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `PUT /rounds/:id/rating` body. Creates or replaces the caller's own rating. */
export interface RateRoundBody {
  stars: number;
  comment?: string;
}

/**
 * `GET /rounds/mine` — a round the caller has joined, in ANY status, plus the
 * rating they left (null until they rate). The resident feed (`GET /rounds`) stays
 * OPEN-only; this is the "My Requests" view.
 */
export interface MyRoundDto extends RoundDto {
  myRating: RatingDto | null;
}

/** An aggregate of ratings. `average` is rounded to one decimal, null when count is 0. */
export interface RatingSummary {
  average: number | null;
  count: number;
}

/** `POST`/`PATCH /rounds/:id/join` body — pledge (or change) a number of units (>=1). */
export interface JoinRoundBody {
  units: number;
}

/* ---------------------------------------------------------------------------
 * Super-admin dashboard (FEAT-005, ADR-0012)
 * ------------------------------------------------------------------------- */

/** A vendor (global, city-level; admin-managed, no login). Deactivate instead of delete. */
export interface VendorDto {
  id: string;
  name: string;
  phone: string;
  category: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** Average of every rating on this vendor's rounds, 1 decimal; null when unrated (FEAT-007). */
  averageRating: number | null;
  /** How many ratings that average is based on — never read the average without it. */
  ratingCount: number;
}

/** `POST /admin/vendors` body. */
export interface CreateVendorBody {
  name: string;
  phone: string;
  category?: string;
  notes?: string;
}

/** `PATCH /admin/vendors/:id` body; all fields optional, null clears an optional field. */
export interface UpdateVendorBody {
  name?: string;
  phone?: string;
  category?: string | null;
  notes?: string | null;
  active?: boolean;
}

/** `GET /admin/societies` row. */
export interface AdminSocietyDto {
  id: string;
  name: string;
  city: string;
  inviteCode: string;
}

/** Compact society reference embedded in admin round views. */
export interface AdminSocietySummary {
  id: string;
  name: string;
  city: string;
}

/** Compact vendor reference embedded in admin round views. */
export interface AdminVendorSummary {
  id: string;
  name: string;
  phone: string;
}

/**
 * Payment collection summary for a round. Amounts are integer rupees, computed as
 * `finalPrice × units`, and are 0 until a final price is set (no vendor assigned yet).
 */
export interface AdminRoundPaymentSummary {
  participantsCount: number;
  collectedCount: number;
  collectedAmount: number;
  outstandingAmount: number;
}

/**
 * Super-admin view of a round across societies (`GET /admin/rounds`). `currentPrice` and
 * `nextTier` are the tier pricing at the current unit count (as the residents see it); `finalPrice` is
 * the negotiated per-unit price set at assignment. Timestamps are ISO strings.
 */
export interface AdminRoundSummaryDto {
  id: string;
  status: RoundStatus;
  society: AdminSocietySummary;
  service: RoundServiceSummary;
  unitsCount: number;
  participantsCount: number;
  currentPrice: number;
  nextTier?: RoundTierDto;
  tiers: RoundTierDto[];
  deadline: string;
  createdAt: string;
  vendor: AdminVendorSummary | null;
  finalPrice: number | null;
  assignedAt: string | null;
  deliveredAt: string | null;
  payments: AdminRoundPaymentSummary;
}

/** One resident's participation as seen by the super-admin (includes PII: admin-only). */
export interface AdminRoundParticipantDto {
  id: string;
  resident: { id: string; name: string | null; phone: string };
  units: number;
  /** `finalPrice × units`, or null until a final price is set. */
  amountDue: number | null;
  paymentCollected: boolean;
  paymentCollectedAt: string | null;
  joinedAt: string;
  /** What this resident thought of the job, or null if they have not rated (FEAT-007). */
  rating: { stars: number; comment: string | null; ratedAt: string } | null;
}

/** `GET /admin/rounds/:id`: the summary plus every participant and the round's ratings. */
export interface AdminRoundDetailDto extends AdminRoundSummaryDto {
  participants: AdminRoundParticipantDto[];
  /** Average + count over this round's ratings (FEAT-007). */
  ratings: RatingSummary;
}

/** `GET /admin/rounds` query filters (both optional). */
export interface AdminRoundsQuery {
  status?: RoundStatus;
  societyId?: string;
}

/** `POST /admin/rounds/:id/assign` body: vendor + negotiated per-unit price (integer ₹, 1–1,000,000). */
export interface AssignRoundBody {
  vendorId: string;
  finalPrice: number;
}

/** `PUT /admin/rounds/:roundId/participants/:participantId/payment` body. */
export interface SetPaymentBody {
  collected: boolean;
}

/** Demand pledged in OPEN rounds for one society. */
export interface AdminSocietyDemand {
  society: AdminSocietySummary;
  openRounds: number;
  unitsPledged: number;
  residentsJoined: number;
}

/** `GET /admin/dashboard`. */
export interface AdminDashboardDto {
  /** Count of rounds in every status (all 7 keys present, zeros included). */
  statusCounts: Record<RoundStatus, number>;
  /** One entry per society (including societies with no open rounds), ordered by name. */
  demandBySociety: AdminSocietyDemand[];
  /** Totals over ASSIGNED / DELIVERED / RATED rounds (integer ₹). */
  payments: { collectedAmount: number; outstandingAmount: number };
  /**
   * Platform-wide rating aggregate (FEAT-007) — the BRIEF's success metric
   * ("delivered jobs average ≥ 4.0 / 5"). `{ average: null, count: 0 }` when nobody
   * has rated yet.
   */
  ratings: RatingSummary;
}
