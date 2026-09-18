import { describe, expect, it } from 'vitest';
import { formatUnits, unitLabelFor, unitLabelPluralFor } from './units';

const room = { unitLabel: 'room', unitLabelPlural: 'rooms' };

/**
 * These cases mirror `apps/backend/src/modules/rounds/units.spec.ts` exactly. The two
 * formatters are duplicated on purpose — a runtime import from `@bulk/shared` breaks
 * the production Vite build (CommonJS named exports; CHORE-004 caught it) — so the
 * identical assertions are what keep them from drifting.
 */
describe('unit labels (FEAT-010, web copy)', () => {
  it('uses the service’s own word, singular for exactly one', () => {
    expect(formatUnits(1, room)).toBe('1 room');
    expect(formatUnits(2, room)).toBe('2 rooms');
    expect(formatUnits(1, { unitLabel: 'AC unit', unitLabelPlural: 'AC units' })).toBe('1 AC unit');
  });

  it('never derives the plural by appending "s"', () => {
    const irregular = { unitLabel: 'sq ft', unitLabelPlural: 'sq ft' };
    expect(formatUnits(1, irregular)).toBe('1 sq ft');
    expect(formatUnits(250, irregular)).toBe('250 sq ft');
  });

  it('falls back to unit/units so an unlabelled service still reads correctly', () => {
    const blank = { unitLabel: '', unitLabelPlural: '   ' };
    expect(formatUnits(1, blank)).toBe('1 unit');
    expect(formatUnits(4, blank)).toBe('4 units');
    expect(unitLabelFor(blank)).toBe('unit');
    expect(unitLabelPluralFor(blank)).toBe('units');
  });

  it('takes the plural for zero', () => {
    expect(formatUnits(0, room)).toBe('0 rooms');
  });
});
