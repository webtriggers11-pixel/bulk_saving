import { describe, expect, it } from 'vitest';
import { buildRoundsQueryString } from './admin.api';

describe('buildRoundsQueryString', () => {
  it('is empty with no filters', () => {
    expect(buildRoundsQueryString({})).toBe('');
  });

  it('includes only the filters that are set', () => {
    expect(buildRoundsQueryString({ status: 'CLOSED_MET' })).toBe('?status=CLOSED_MET');
    expect(buildRoundsQueryString({ societyId: 'soc_1' })).toBe('?societyId=soc_1');
    expect(buildRoundsQueryString({ status: 'OPEN', societyId: 'soc 1' })).toBe(
      '?status=OPEN&societyId=soc+1',
    );
  });
});
