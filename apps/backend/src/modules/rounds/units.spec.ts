import cases from '../../../../../packages/shared/src/unit-format-cases.json';
import { formatUnits, unitLabelFor, unitLabelPluralFor } from './units';

const room = { unitLabel: 'room', unitLabelPlural: 'rooms' };
const acUnit = { unitLabel: 'AC unit', unitLabelPlural: 'AC units' };

/**
 * The shared case table is the ONLY thing keeping this formatter and the web copy
 * (`apps/web/src/lib/units.ts`) in step (V2 P2): they are duplicated on purpose,
 * because a runtime import from `@bulk/shared` breaks the web production build, and
 * per-app tests would otherwise let an implementation and its own test drift together.
 */
describe('the shared case table (pins both apps to one behaviour)', () => {
  it.each(cases)('$count of $unitLabel → $expected', ({ count, expected, ...labels }) => {
    expect(formatUnits(count, labels)).toBe(expected);
  });
});

describe('unit labels (FEAT-010)', () => {
  it('uses the service’s own word, singular for exactly one', () => {
    expect(formatUnits(1, room)).toBe('1 room');
    expect(formatUnits(2, room)).toBe('2 rooms');
    expect(formatUnits(1, acUnit)).toBe('1 AC unit');
    expect(formatUnits(3, acUnit)).toBe('3 AC units');
  });

  it('never derives the plural by appending "s"', () => {
    // The whole reason plural is stored: this must come out as the admin wrote it.
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
