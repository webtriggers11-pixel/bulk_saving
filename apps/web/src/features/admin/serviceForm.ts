import type { AdminServiceDto, CreateServiceBody, ServiceCategory, UpdateServiceBody } from '@bulk/shared';

/**
 * The closed category list (FEAT-014, ADR-0025), in catalog order. A copy, not an
 * import: `@bulk/shared` builds to CommonJS and the Vite build cannot see its runtime
 * exports (see rating-cap.test.ts). `serviceForm.test.ts` fails on any drift.
 */
export const SERVICE_CATEGORY_OPTIONS: readonly ServiceCategory[] = [
  'Appliances',
  'Home Care',
  'Renovation',
  'Utilities',
  'Vehicle',
  'Bulk Staples',
];

/** Mirrors the backend caps — pinned to `@bulk/shared` by the same test. */
export const UNIT_LABEL_MAX = 16;
export const UNIT_DESCRIPTION_MAX = 140;
const NAME_MAX = 120;
const SLUG_MAX = 120;
const DESCRIPTION_MAX = 2000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Raw (untrimmed) service form values, as typed. */
export interface ServiceFormValues {
  name: string;
  slug: string;
  description: string;
  category: string;
  unitLabel: string;
  unitLabelPlural: string;
  unitDescription: string;
}

export type ServiceFormErrors = Partial<Record<keyof ServiceFormValues, string>>;

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  name: '',
  slug: '',
  description: '',
  category: '',
  unitLabel: '',
  unitLabelPlural: '',
  unitDescription: '',
};

/** "Water Tank Cleaning (500 L)" → "water-tank-cleaning-500-l": the slug a name implies. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX);
}

/** The edit form's starting values for an existing service. */
export function toServiceFormValues(service: AdminServiceDto): ServiceFormValues {
  return {
    name: service.name,
    slug: service.slug,
    description: service.description,
    category: service.category,
    unitLabel: service.unitLabel,
    unitLabelPlural: service.unitLabelPlural,
    unitDescription: service.unitDescription ?? '',
  };
}

function isCategory(value: string): value is ServiceCategory {
  return (SERVICE_CATEGORY_OPTIONS as readonly string[]).includes(value);
}

/**
 * Client-side validation, mirroring the server's DTO rules. `originalCategory` is the
 * service's stored category on edit: a row from before ADR-0025 may hold one outside the
 * list, and editing its name must not force the admin to recategorise it.
 */
export function validateServiceForm(
  values: ServiceFormValues,
  originalCategory?: string,
): ServiceFormErrors {
  const errors: ServiceFormErrors = {};
  const name = values.name.trim();
  if (name.length === 0) {
    errors.name = 'Name is required.';
  } else if (name.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters.`;
  }
  const slug = values.slug.trim();
  if (!SLUG_PATTERN.test(slug) || slug.length > SLUG_MAX) {
    errors.slug = 'Slug must be lowercase letters and numbers, separated by single hyphens.';
  }
  const description = values.description.trim();
  if (description.length === 0) {
    errors.description = 'Description is required.';
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${DESCRIPTION_MAX} characters.`;
  }
  if (!isCategory(values.category) && values.category !== originalCategory) {
    errors.category = 'Choose a category.';
  }
  // The pair is set together or not at all (ADR-0019): the plural is never derived.
  const singular = values.unitLabel.trim();
  const plural = values.unitLabelPlural.trim();
  if (singular && !plural) {
    errors.unitLabelPlural = 'Give the plural too — it is never guessed from the singular.';
  } else if (plural && !singular) {
    errors.unitLabel = 'Give the singular too.';
  }
  if (singular.length > UNIT_LABEL_MAX) {
    errors.unitLabel = `At most ${UNIT_LABEL_MAX} characters.`;
  }
  if (plural.length > UNIT_LABEL_MAX) {
    errors.unitLabelPlural = `At most ${UNIT_LABEL_MAX} characters.`;
  }
  if (values.unitDescription.trim().length > UNIT_DESCRIPTION_MAX) {
    errors.unitDescription = `At most ${UNIT_DESCRIPTION_MAX} characters.`;
  }
  return errors;
}

/** Trimmed create body; empty optional fields are omitted (the server defaults to unit/units). */
export function toCreateServiceBody(values: ServiceFormValues): CreateServiceBody {
  const body: CreateServiceBody = {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim(),
    // validateServiceForm has already refused anything outside the list.
    category: values.category as ServiceCategory,
  };
  const singular = values.unitLabel.trim();
  const plural = values.unitLabelPlural.trim();
  if (singular && plural) {
    body.unitLabel = singular;
    body.unitLabelPlural = plural;
  }
  const scope = values.unitDescription.trim();
  if (scope) {
    body.unitDescription = scope;
  }
  return body;
}

/**
 * Trimmed update body. An unchanged legacy category is left out rather than resent
 * (the server would refuse it); emptied unit labels restore the unit/units default,
 * and an emptied scope sentence is cleared with null.
 */
export function toUpdateServiceBody(
  values: ServiceFormValues,
  originalCategory: string,
): UpdateServiceBody {
  const body: UpdateServiceBody = {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim(),
    unitLabel: values.unitLabel.trim() || 'unit',
    unitLabelPlural: values.unitLabelPlural.trim() || 'units',
    unitDescription: values.unitDescription.trim() || null,
  };
  if (values.category !== originalCategory && isCategory(values.category)) {
    body.category = values.category;
  }
  return body;
}

/** Services grouped by category: listed categories in catalog order, then any legacy ones. */
export function groupByCategory(services: readonly AdminServiceDto[]): Array<[string, AdminServiceDto[]]> {
  const groups = new Map<string, AdminServiceDto[]>();
  for (const category of SERVICE_CATEGORY_OPTIONS) {
    groups.set(category, []);
  }
  for (const service of services) {
    const group = groups.get(service.category) ?? [];
    group.push(service);
    groups.set(service.category, group);
  }
  return [...groups.entries()]
    .filter(([, rows]) => rows.length > 0)
    .map(([category, rows]) => [category, [...rows].sort((a, b) => a.name.localeCompare(b.name))]);
}

/** "₹499" → 499; "" → null (no indicative price); anything else → undefined (invalid). */
export function parseIndicativePrice(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(/^₹/, '').replace(/,/g, '');
  if (trimmed === '') {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  return Number(trimmed);
}
