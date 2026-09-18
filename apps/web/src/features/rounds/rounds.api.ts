import type { JoinRoundBody, MyRoundDto, RoundDto } from '@bulk/shared';
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

/**
 * GET /rounds/mine — rounds the caller has JOINED, in any status, newest first
 * (FEAT-007). `GET /rounds` is OPEN-only, so it cannot back "My Requests": a
 * round would vanish from the tab the moment it closed, which is exactly when a
 * resident most wants to see it.
 */
export function fetchMyRounds(): Promise<MyRoundDto[]> {
  return apiRequest<MyRoundDto[]>('/rounds/mine');
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
