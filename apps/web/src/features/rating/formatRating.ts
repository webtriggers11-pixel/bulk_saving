import type { RatingSummary } from '@bulk/shared';

/**
 * A rating aggregate as one string: `"4.5 (8)"`, or an explicit "No ratings yet"
 * when nobody has rated.
 *
 * The count is NEVER dropped: 5.0 from one rating and 5.0 from fifty are very
 * different claims about a vendor (ADR-0017), and an admin deciding who to assign
 * next needs to see which one they are looking at. A null average must also never
 * render as `0` — a vendor nobody has rated would look terrible rather than new.
 */
export function formatRatingSummary(summary: RatingSummary): string {
  if (summary.average === null || summary.count === 0) {
    return 'No ratings yet';
  }
  return `${summary.average.toFixed(1)} (${summary.count})`;
}

/** The same rule for a vendor row, which carries the two fields flat. */
export function formatVendorRating(vendor: {
  averageRating: number | null;
  ratingCount: number;
}): string {
  return formatRatingSummary({ average: vendor.averageRating, count: vendor.ratingCount });
}
