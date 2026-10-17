import type {
  AdminDashboardDto,
  AdminRoundDetailDto,
  AdminRoundParticipantDto,
  AdminRoundsQuery,
  AdminRoundSummaryDto,
  AdminServiceDto,
  AdminSocietyDto,
  AssignRoundBody,
  CreateRoundBody,
  CreateServiceBody,
  CreateVendorBody,
  RoundDto,
  ServiceOfferingDto,
  SetPaymentBody,
  UpdateServiceBody,
  UpdateVendorBody,
  UpsertOfferingBody,
  VendorDto,
} from '@bulk/shared';
import { apiRequest } from '../../lib/api';

/**
 * Super-admin API (FEAT-005, ADR-0012). Every route is SUPER_ADMIN-only and
 * enforced server-side (a resident token gets 403); the client-side AdminRoute
 * guard is UX only. One typed function per endpoint.
 */

/** GET /admin/dashboard — status counts, demand by society, payment totals. */
export function fetchDashboard(): Promise<AdminDashboardDto> {
  return apiRequest<AdminDashboardDto>('/admin/dashboard');
}

/** GET /admin/societies — every society (for filters and the new-round form). */
export function fetchSocieties(): Promise<AdminSocietyDto[]> {
  return apiRequest<AdminSocietyDto[]>('/admin/societies');
}

/** GET /admin/services — every master service, including inactive ones. */
export function fetchServices(): Promise<AdminServiceDto[]> {
  return apiRequest<AdminServiceDto[]>('/admin/services');
}

/** POST /admin/services — create a master service (409 SERVICE_SLUG_TAKEN for a duplicate slug). */
export function createService(body: CreateServiceBody): Promise<AdminServiceDto> {
  return apiRequest<AdminServiceDto>('/admin/services', {
    method: 'POST',
    body: body satisfies CreateServiceBody,
  });
}

/** PATCH /admin/services/:id — edit fields or toggle `active`. */
export function updateService(id: string, body: UpdateServiceBody): Promise<AdminServiceDto> {
  return apiRequest<AdminServiceDto>(`/admin/services/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: body satisfies UpdateServiceBody,
  });
}

/** PUT /admin/societies/:societyId/offerings/:serviceId — offer (or stop offering) a service. */
export function upsertOffering(
  societyId: string,
  serviceId: string,
  body: UpsertOfferingBody,
): Promise<ServiceOfferingDto> {
  return apiRequest<ServiceOfferingDto>(
    `/admin/societies/${encodeURIComponent(societyId)}/offerings/${encodeURIComponent(serviceId)}`,
    { method: 'PUT', body: body satisfies UpsertOfferingBody },
  );
}

/** Build `?status=&societyId=` from the filters, omitting empty values. */
export function buildRoundsQueryString(query: AdminRoundsQuery): string {
  const params = new URLSearchParams();
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.societyId) {
    params.set('societyId', query.societyId);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** GET /admin/rounds — round summaries across societies, newest first. */
export function fetchAdminRounds(query: AdminRoundsQuery = {}): Promise<AdminRoundSummaryDto[]> {
  return apiRequest<AdminRoundSummaryDto[]>(`/admin/rounds${buildRoundsQueryString(query)}`);
}

/** GET /admin/rounds/:id — one round plus its participants. */
export function fetchAdminRound(id: string): Promise<AdminRoundDetailDto> {
  return apiRequest<AdminRoundDetailDto>(`/admin/rounds/${encodeURIComponent(id)}`);
}

/** POST /admin/rounds — open a round (409 ROUND_ALREADY_OPEN for a duplicate). */
export function createRound(body: CreateRoundBody): Promise<RoundDto> {
  return apiRequest<RoundDto>('/admin/rounds', {
    method: 'POST',
    body: body satisfies CreateRoundBody,
  });
}

/** POST /admin/rounds/:id/close — OPEN → CLOSED_MET | CLOSED_EXPIRED. */
export function closeRound(id: string): Promise<RoundDto> {
  return apiRequest<RoundDto>(`/admin/rounds/${encodeURIComponent(id)}/close`, {
    method: 'POST',
  });
}

/** POST /admin/rounds/:id/cancel — any pre-DELIVERED status → CANCELLED. */
export function cancelRound(id: string): Promise<RoundDto> {
  return apiRequest<RoundDto>(`/admin/rounds/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}

/** POST /admin/rounds/:id/assign — CLOSED_MET → ASSIGNED with vendor + final price. */
export function assignRound(id: string, body: AssignRoundBody): Promise<AdminRoundDetailDto> {
  return apiRequest<AdminRoundDetailDto>(`/admin/rounds/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    body: body satisfies AssignRoundBody,
  });
}

/** POST /admin/rounds/:id/deliver — ASSIGNED → DELIVERED. */
export function deliverRound(id: string): Promise<AdminRoundDetailDto> {
  return apiRequest<AdminRoundDetailDto>(`/admin/rounds/${encodeURIComponent(id)}/deliver`, {
    method: 'POST',
  });
}

/** PUT /admin/rounds/:roundId/participants/:participantId/payment — set/clear collected. */
export function setPayment(
  roundId: string,
  participantId: string,
  body: SetPaymentBody,
): Promise<AdminRoundParticipantDto> {
  return apiRequest<AdminRoundParticipantDto>(
    `/admin/rounds/${encodeURIComponent(roundId)}/participants/${encodeURIComponent(participantId)}/payment`,
    { method: 'PUT', body: body satisfies SetPaymentBody },
  );
}

/** GET /admin/vendors — the global vendor list. */
export function fetchVendors(): Promise<VendorDto[]> {
  return apiRequest<VendorDto[]>('/admin/vendors');
}

/** POST /admin/vendors — add a vendor. */
export function createVendor(body: CreateVendorBody): Promise<VendorDto> {
  return apiRequest<VendorDto>('/admin/vendors', {
    method: 'POST',
    body: body satisfies CreateVendorBody,
  });
}

/** PATCH /admin/vendors/:id — edit fields or toggle `active`. */
export function updateVendor(id: string, body: UpdateVendorBody): Promise<VendorDto> {
  return apiRequest<VendorDto>(`/admin/vendors/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: body satisfies UpdateVendorBody,
  });
}
