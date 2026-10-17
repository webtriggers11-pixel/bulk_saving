import type { CatalogQuery, ServiceDto } from '@bulk/shared';
import { apiRequest } from '../../lib/api';
import { toQueryString } from '../../lib/filters';

/**
 * GET /catalog — the services available in the caller's society (FEAT-002).
 * Tenant scope is derived server-side from the access token; the client sends
 * no societyId — FEAT-015's filters narrow within it and can never name another.
 */
export function fetchCatalog(query: CatalogQuery = {}): Promise<ServiceDto[]> {
  return apiRequest<ServiceDto[]>(`/catalog${toQueryString(query)}`);
}
