import { describe, expect, it } from 'vitest';
import { formatRatingSummary, formatVendorRating } from './formatRating';

describe('formatRatingSummary', () => {
  it('shows the average with its count, always', () => {
    // The count is the point: 5.0 from one rating is not 5.0 from fifty (ADR-0017).
    expect(formatRatingSummary({ average: 4.5, count: 8 })).toBe('4.5 (8)');
    expect(formatRatingSummary({ average: 5, count: 1 })).toBe('5.0 (1)');
  });

  it('keeps one decimal so 4 does not read as more precise than 4.3', () => {
    expect(formatRatingSummary({ average: 4, count: 3 })).toBe('4.0 (3)');
    expect(formatRatingSummary({ average: 4.3, count: 3 })).toBe('4.3 (3)');
  });

  it('never renders an unrated aggregate as 0 — that would read as "terrible"', () => {
    expect(formatRatingSummary({ average: null, count: 0 })).toBe('No ratings yet');
    expect(formatRatingSummary({ average: null, count: 0 })).not.toContain('0.0');
  });

  it('treats a zero count as unrated even if an average slipped through', () => {
    expect(formatRatingSummary({ average: 3, count: 0 })).toBe('No ratings yet');
  });
});

describe('formatVendorRating', () => {
  it('applies the same rule to a vendor row', () => {
    expect(formatVendorRating({ averageRating: 3.7, ratingCount: 12 })).toBe('3.7 (12)');
    expect(formatVendorRating({ averageRating: null, ratingCount: 0 })).toBe('No ratings yet');
  });
});
