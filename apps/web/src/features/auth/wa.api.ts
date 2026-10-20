import type { AuthMethods, WaStartBody, WaStartResponse, WaStatusResponse } from '@bulk/shared';
import { apiRequest } from '../../lib/api';

/** GET /auth/methods — which sign-in methods this server offers (FEAT-027). */
export function fetchAuthMethods(): Promise<AuthMethods> {
  return apiRequest<AuthMethods>('/auth/methods', { auth: false });
}

/** POST /auth/wa/start — a WhatsApp sign-in for the society the invite code names. */
export function startWhatsAppLogin(body: WaStartBody): Promise<WaStartResponse> {
  return apiRequest<WaStartResponse>('/auth/wa/start', { method: 'POST', body, auth: false });
}

/** POST /auth/admin/wa/start — the admin door's; no body, nothing to say yet (ADR-0023). */
export function startAdminWhatsAppLogin(): Promise<WaStartResponse> {
  return apiRequest<WaStartResponse>('/auth/admin/wa/start', { method: 'POST', body: {}, auth: false });
}

/** GET /auth/wa/status/:requestId — polled until a terminal state; `confirmed` carries the tokens. */
export function fetchWhatsAppStatus(requestId: string): Promise<WaStatusResponse> {
  return apiRequest<WaStatusResponse>(`/auth/wa/status/${encodeURIComponent(requestId)}`, { auth: false });
}
