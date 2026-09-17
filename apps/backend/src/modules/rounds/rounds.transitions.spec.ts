import { RoundStatus } from '@bulk/shared';
import { LEGAL_TRANSITIONS, isLegalTransition } from './rounds.transitions';

/**
 * Transition-guard matrix (FEAT-004 T2, ADR-0011). Pins EVERY (from, to) pair —
 * all 49 — so a future feature cannot silently widen the state machine.
 */
describe('round lifecycle transitions (full legal/illegal matrix)', () => {
  const S = RoundStatus;
  const ALL: RoundStatus[] = Object.values(S);

  const LEGAL = new Set<string>([
    `${S.OPEN}->${S.CLOSED_MET}`,
    `${S.OPEN}->${S.CLOSED_EXPIRED}`,
    `${S.OPEN}->${S.CANCELLED}`,
    `${S.CLOSED_MET}->${S.ASSIGNED}`,
    `${S.CLOSED_MET}->${S.CANCELLED}`,
    `${S.CLOSED_EXPIRED}->${S.CANCELLED}`,
    `${S.ASSIGNED}->${S.DELIVERED}`,
    `${S.ASSIGNED}->${S.CANCELLED}`,
    `${S.DELIVERED}->${S.RATED}`,
  ]);

  const pairs = ALL.flatMap((from) => ALL.map((to) => [from, to] as const));

  it('covers all 7 statuses in the map', () => {
    expect(Object.keys(LEGAL_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  it.each(pairs)('%s -> %s', (from, to) => {
    expect(isLegalTransition(from, to)).toBe(LEGAL.has(`${from}->${to}`));
  });

  it('RATED and CANCELLED are terminal', () => {
    expect(LEGAL_TRANSITIONS[S.RATED]).toEqual([]);
    expect(LEGAL_TRANSITIONS[S.CANCELLED]).toEqual([]);
  });

  it('CANCELLED is reachable from every pre-DELIVERED state and nowhere else', () => {
    const from = ALL.filter((s) => isLegalTransition(s, S.CANCELLED)).sort();
    expect(from).toEqual([S.ASSIGNED, S.CLOSED_EXPIRED, S.CLOSED_MET, S.OPEN].sort());
  });
});
