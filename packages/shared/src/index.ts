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
