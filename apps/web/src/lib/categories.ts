import type { ServiceCategory } from '@bulk/shared';

/**
 * The closed category list (FEAT-014, ADR-0025), in catalog order — shared by the admin
 * form, the admin filters and the resident catalog's chips (FEAT-015).
 *
 * A copy, not an import: `@bulk/shared` builds to CommonJS and the Vite build cannot see
 * its runtime exports (see rating-cap.test.ts). `serviceForm.test.ts` fails on any drift.
 */
export const SERVICE_CATEGORY_OPTIONS: readonly ServiceCategory[] = [
  'Appliances',
  'Home Care',
  'Renovation',
  'Utilities',
  'Vehicle',
  'Bulk Staples',
];

/** "All" plus one chip per category — the option list every category filter shows. */
export const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  ...SERVICE_CATEGORY_OPTIONS.map((category) => ({ value: category, label: category })),
];

/** True for a category on the closed list — a URL's `?category=` is checked against it. */
export function isListedCategory(value: string): boolean {
  return (SERVICE_CATEGORY_OPTIONS as readonly string[]).includes(value);
}
