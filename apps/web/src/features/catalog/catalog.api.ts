import type { ServiceDto } from '@bulk/shared';
import { apiRequest } from '../../lib/api';

/**
 * GET /catalog — the services available in the caller's society (FEAT-002).
 * Tenant scope is derived server-side from the access token; the client sends
 * no societyId. Returns a typed `ServiceDto[]`.
 */
export function fetchCatalog(): Promise<ServiceDto[]> {
  return apiRequest<ServiceDto[]>('/catalog');
}
