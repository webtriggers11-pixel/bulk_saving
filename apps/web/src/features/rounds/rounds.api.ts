import type { JoinRoundBody, RoundDto } from '@bulk/shared';
import { apiRequest } from '../../lib/api';

/**
 * Resident-facing rounds API (FEAT-003). Every route is tenant-scoped server-side
 * from the access token (ADR-0003) — the client never sends a societyId. The join
 * endpoints all return the freshly recomputed {@link RoundDto} (live unit count +
 * current tier), which the mutation hooks use to refresh the cache.
 */

/** GET /rounds — OPEN rounds in the caller's society, with pricing + the caller's pledge. */
export function fetchRounds(): Promise<RoundDto[]> {
  return apiRequest<RoundDto[]>('/rounds');
}

/** POST /rounds/:id/join — pledge `units` (>=1); records/updates participation atomically. */
export function joinRound(id: string, units: number): Promise<RoundDto> {
  return apiRequest<RoundDto>(`/rounds/${id}/join`, {
    method: 'POST',
    body: { units } satisfies JoinRoundBody,
  });
}

/** PATCH /rounds/:id/join — change the caller's existing pledge to `units`. */
export function updatePledge(id: string, units: number): Promise<RoundDto> {
  return apiRequest<RoundDto>(`/rounds/${id}/join`, {
    method: 'PATCH',
    body: { units } satisfies JoinRoundBody,
  });
}

/** DELETE /rounds/:id/join — remove the caller's participation; decrements atomically. */
export function leaveRound(id: string): Promise<RoundDto> {
  return apiRequest<RoundDto>(`/rounds/${id}/join`, { method: 'DELETE' });
}
