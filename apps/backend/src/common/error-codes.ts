/**
 * Canonical error codes for the standard API envelope. Extend as domains land.
 */
export const ErrorCode = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  // Auth / onboarding (FEAT-001)
  INVALID_INVITE_CODE: 'INVALID_INVITE_CODE',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_LOCKED: 'OTP_LOCKED',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  // Catalog (FEAT-002)
  SERVICE_SLUG_TAKEN: 'SERVICE_SLUG_TAKEN',
  // Rounds (FEAT-003)
  ROUND_ALREADY_OPEN: 'ROUND_ALREADY_OPEN',
  ROUND_CLOSED: 'ROUND_CLOSED',
  // Rounds lifecycle (FEAT-004)
  INVALID_ROUND_TRANSITION: 'INVALID_ROUND_TRANSITION',
  // Super-admin dashboard (FEAT-005)
  VENDOR_INACTIVE: 'VENDOR_INACTIVE',
  PAYMENT_NOT_ALLOWED: 'PAYMENT_NOT_ALLOWED',
  PAYMENTS_COLLECTED: 'PAYMENTS_COLLECTED',
  // Ratings (FEAT-007)
  NOT_A_PARTICIPANT: 'NOT_A_PARTICIPANT',
  ROUND_NOT_DELIVERED: 'ROUND_NOT_DELIVERED',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Map an HTTP status to a default machine-readable error code. */
export function errorCodeForStatus(status: number): ErrorCodeValue {
  switch (status) {
    case 400:
      return ErrorCode.BAD_REQUEST;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 422:
      return ErrorCode.VALIDATION_ERROR;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}
