import { RoundStatus } from '@bulk/shared';

/**
 * The round lifecycle state machine (FEAT-004, ADR-0011). A single source of
 * truth for which status changes are legal; `RoundsService.transition()` is the
 * ONLY place this map is consulted, and no round `status` is mutated outside that
 * guarded path (ARCHITECTURE invariant).
 *
 * OPEN            -> CLOSED_MET | CLOSED_EXPIRED | CANCELLED
 * CLOSED_MET      -> ASSIGNED | CANCELLED
 * CLOSED_EXPIRED  -> CANCELLED
 * ASSIGNED        -> DELIVERED | CANCELLED
 * DELIVERED       -> RATED
 * RATED           -> (terminal)
 * CANCELLED       -> (terminal)
 *
 * Pure data + a pure validator so the full legal/illegal matrix is unit-testable
 * without a database.
 */
export const LEGAL_TRANSITIONS: Readonly<Record<RoundStatus, readonly RoundStatus[]>> = {
  [RoundStatus.OPEN]: [RoundStatus.CLOSED_MET, RoundStatus.CLOSED_EXPIRED, RoundStatus.CANCELLED],
  [RoundStatus.CLOSED_MET]: [RoundStatus.ASSIGNED, RoundStatus.CANCELLED],
  [RoundStatus.CLOSED_EXPIRED]: [RoundStatus.CANCELLED],
  [RoundStatus.ASSIGNED]: [RoundStatus.DELIVERED, RoundStatus.CANCELLED],
  [RoundStatus.DELIVERED]: [RoundStatus.RATED],
  [RoundStatus.RATED]: [],
  [RoundStatus.CANCELLED]: [],
};

/** True iff a round may move directly from `from` to `to`. Self-transitions are illegal. */
export function isLegalTransition(from: RoundStatus, to: RoundStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}
