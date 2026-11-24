import type {
  AdminOtpRequestBody,
  AdminOtpVerifyBody,
  AuthResult,
  InviteCheckBody,
  InviteCheckResponse,
  MeResponse,
  OtpRequestBody,
  OtpRequestResponse,
  OtpVerifyBody,
  RefreshBody,
  SignOutResponse,
} from '@bulk/shared';
import { apiRequest } from '../../lib/api';

/**
 * POST /auth/invite/check (FEAT-045, ADR-0052) — is this a real, active society's code? A wrong
 * one rejects with INVALID_INVITE_CODE, so the invite step can say so before moving on.
 */
export function checkInvite(body: InviteCheckBody): Promise<InviteCheckResponse> {
  return apiRequest<InviteCheckResponse>('/auth/invite/check', {
    method: 'POST',
    body,
    auth: false,
  });
}

/** POST /auth/otp/request — dispatches an OTP. Never returns the code. */
export function requestOtp(body: OtpRequestBody): Promise<OtpRequestResponse> {
  return apiRequest<OtpRequestResponse>('/auth/otp/request', {
    method: 'POST',
    body,
    auth: false,
  });
}

/** POST /auth/otp/verify — verifies the OTP and returns tokens + resident. */
export function verifyOtp(body: OtpVerifyBody): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/otp/verify', {
    method: 'POST',
    body,
    auth: false,
  });
}

/**
 * POST /auth/admin/otp/request — the admin door (FEAT-012). Answers the same whether
 * or not the number belongs to an admin, so the client learns nothing from it either.
 */
export function requestAdminOtp(body: AdminOtpRequestBody): Promise<OtpRequestResponse> {
  return apiRequest<OtpRequestResponse>('/auth/admin/otp/request', {
    method: 'POST',
    body,
    auth: false,
  });
}

/** POST /auth/admin/otp/verify — verifies the code and returns tokens + the admin. */
export function verifyAdminOtp(body: AdminOtpVerifyBody): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/admin/otp/verify', {
    method: 'POST',
    body,
    auth: false,
  });
}

/** POST /auth/sign-out — ends this device's session on the server (BUG-017). */
export function endSession(body: RefreshBody): Promise<SignOutResponse> {
  return apiRequest<SignOutResponse>('/auth/sign-out', { method: 'POST', body });
}

/** GET /me — the caller's own profile + society, scoped by the token. */
export function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me');
}
