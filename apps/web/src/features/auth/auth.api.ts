import type {
  AuthResult,
  MeResponse,
  OtpRequestBody,
  OtpRequestResponse,
  OtpVerifyBody,
} from '@bulk/shared';
import { apiRequest } from '../../lib/api';

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

/** GET /me — the caller's own profile + society, scoped by the token. */
export function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me');
}
