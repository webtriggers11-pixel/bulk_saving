/**
 * Rendering a unit count with the SERVICE'S word for it (FEAT-010, ADR-0019).
 *
 * Pure, and deliberately duplicated in `apps/backend/src/modules/rounds/units.ts` rather than shared:
 * `@bulk/shared` builds to CommonJS, so a runtime import of it breaks the web
 * production Vite build (CHORE-004 caught exactly that). The two copies are pinned to
 * the same behaviour by a test in each app.
 */

/** The two fields any count needs to render itself. */
export interface UnitLabelled {
  unitLabel: string;
  unitLabelPlural: string;
}

/** Fallbacks, so an unlabelled service degrades to the pre-FEAT-010 wording. */
const FALLBACK_SINGULAR = 'unit';
const FALLBACK_PLURAL = 'units';

/** The singular label, e.g. for "₹700 / room". Never empty. */
export function unitLabelFor(service: UnitLabelled): string {
  const label = service.unitLabel?.trim();
  return label && label.length > 0 ? label : FALLBACK_SINGULAR;
}

/** The plural label. Never empty, and never derived by appending "s". */
export function unitLabelPluralFor(service: UnitLabelled): string {
  const label = service.unitLabelPlural?.trim();
  return label && label.length > 0 ? label : FALLBACK_PLURAL;
}

/**
 * `1` → "1 room", `2` → "2 rooms". Exactly 1 is singular; everything else — including
 * 0 and negatives, which callers should not pass but might — takes the plural.
 */
export function formatUnits(count: number, service: UnitLabelled): string {
  return `${count} ${count === 1 ? unitLabelFor(service) : unitLabelPluralFor(service)}`;
}

/** `room` → `Rooms`-style form labels. Web-only: the backend never capitalises. */
export function capitalise(label: string): string {
  return label.length === 0 ? label : label[0].toUpperCase() + label.slice(1);
}
