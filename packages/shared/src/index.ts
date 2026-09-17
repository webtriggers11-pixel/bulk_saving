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

/** `POST /auth/otp/request` success payload — never contains the OTP. */
export interface OtpRequestResponse {
  requested: true;
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

/** `POST`/`PATCH /rounds/:id/join` body — pledge (or change) a number of units (>=1). */
export interface JoinRoundBody {
  units: number;
}
