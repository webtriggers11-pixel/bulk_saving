import { MAX_INDICATIVE_PRICE, MAX_UNIT_DESCRIPTION, MAX_UNIT_LABEL, SERVICE_CATEGORIES, type AdminServiceDto } from '@bulk/shared';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_SERVICE_FORM,
  INDICATIVE_PRICE_MAX,
  SERVICE_CATEGORY_OPTIONS,
  UNIT_DESCRIPTION_MAX,
  UNIT_LABEL_MAX,
  groupByCategory,
  parseIndicativePrice,
  slugify,
  toCreateServiceBody,
  toUpdateServiceBody,
  validateServiceForm,
  type ServiceFormValues,
} from './serviceForm';

/**
 * Pins the web copies to `@bulk/shared` (the app cannot import them at runtime — see
 * rating-cap.test.ts). A category added on one side only fails here, not in production.
 */
describe('service form constants are pinned to the server', () => {
  it('has exactly the server category list, in the same order', () => {
    expect([...SERVICE_CATEGORY_OPTIONS]).toEqual([...SERVICE_CATEGORIES]);
  });

  it('has the server unit caps', () => {
    expect(UNIT_LABEL_MAX).toBe(MAX_UNIT_LABEL);
    expect(UNIT_DESCRIPTION_MAX).toBe(MAX_UNIT_DESCRIPTION);
    expect(INDICATIVE_PRICE_MAX).toBe(MAX_INDICATIVE_PRICE);
  });
});

const valid: ServiceFormValues = {
  name: '  Water Tank Cleaning ',
  slug: 'water-tank-cleaning',
  description: ' Drain, scrub and disinfect. ',
  category: 'Utilities',
  unitLabel: ' tank ',
  unitLabelPlural: 'tanks',
  unitDescription: '',
};

const stored: AdminServiceDto = {
  id: 'svc_1',
  name: 'Legacy',
  slug: 'legacy',
  description: 'x',
  category: 'Home',
  imageUrl: null,
  unitLabel: 'unit',
  unitLabelPlural: 'units',
  unitDescription: null,
  active: true,
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
  offerings: [],
};

describe('validateServiceForm', () => {
  it('accepts a complete form', () => {
    expect(validateServiceForm(valid)).toEqual({});
  });

  it('requires a category from the list — free text is how "Home" and "Home Care" split', () => {
    expect(validateServiceForm({ ...valid, category: '' }).category).toBeDefined();
    expect(validateServiceForm({ ...valid, category: 'Groceries' }).category).toBeDefined();
    expect(validateServiceForm({ ...valid, category: 'home care' }).category).toBeDefined();
  });

  it('lets a legacy category through unchanged on edit, but not a new unlisted one', () => {
    expect(validateServiceForm({ ...valid, category: 'Home' }, 'Home').category).toBeUndefined();
    expect(validateServiceForm({ ...valid, category: 'Other' }, 'Home').category).toBeDefined();
  });

  it('refuses half a unit-label pair, either way round', () => {
    expect(validateServiceForm({ ...valid, unitLabelPlural: ' ' }).unitLabelPlural).toBeDefined();
    expect(validateServiceForm({ ...valid, unitLabel: '' }).unitLabel).toBeDefined();
    expect(validateServiceForm({ ...valid, unitLabel: '', unitLabelPlural: '' })).toEqual({});
  });

  it('enforces the label and scope caps', () => {
    expect(validateServiceForm({ ...valid, unitLabel: 'x'.repeat(UNIT_LABEL_MAX + 1) }).unitLabel).toBeDefined();
    expect(validateServiceForm({ ...valid, unitLabel: 'x'.repeat(UNIT_LABEL_MAX) }).unitLabel).toBeUndefined();
    expect(
      validateServiceForm({ ...valid, unitDescription: 'x'.repeat(UNIT_DESCRIPTION_MAX + 1) }).unitDescription,
    ).toBeDefined();
  });

  it('refuses a slug the server would refuse', () => {
    for (const slug of ['', 'Water-Tank', 'water--tank', '-water', 'water tank']) {
      expect(validateServiceForm({ ...valid, slug }).slug).toBeDefined();
    }
  });

  it('flags every missing required field on an empty form', () => {
    expect(Object.keys(validateServiceForm(EMPTY_SERVICE_FORM)).sort()).toEqual(
      ['category', 'description', 'name', 'slug'].sort(),
    );
  });
});

describe('slugify', () => {
  it('derives a slug the validator accepts', () => {
    expect(slugify('Basmati Rice — 25 kg bag')).toBe('basmati-rice-25-kg-bag');
    expect(slugify('  RO / Water Purifier  ')).toBe('ro-water-purifier');
    expect(validateServiceForm({ ...valid, slug: slugify('Car Wash (Exterior)') }).slug).toBeUndefined();
  });
});

describe('request bodies', () => {
  it('create: trims, and omits empty optional fields', () => {
    expect(toCreateServiceBody(valid)).toEqual({
      name: 'Water Tank Cleaning',
      slug: 'water-tank-cleaning',
      description: 'Drain, scrub and disinfect.',
      category: 'Utilities',
      unitLabel: 'tank',
      unitLabelPlural: 'tanks',
    });
  });

  it('update: an unchanged legacy category is not resent — the server would refuse it', () => {
    const body = toUpdateServiceBody({ ...valid, category: 'Home' }, 'Home');
    expect(body).not.toHaveProperty('category');
  });

  it('update: a changed category is sent; cleared labels restore unit/units; cleared scope is null', () => {
    const body = toUpdateServiceBody({ ...valid, unitLabel: '', unitLabelPlural: '' }, stored.category);
    expect(body).toMatchObject({ category: 'Utilities', unitLabel: 'unit', unitLabelPlural: 'units', unitDescription: null });
  });
});

describe('groupByCategory', () => {
  it('orders listed categories first, puts legacy ones after, and sorts by name', () => {
    const groups = groupByCategory([
      stored,
      { ...stored, id: 'a', name: 'Rice', category: 'Bulk Staples' },
      { ...stored, id: 'b', name: 'Geyser', category: 'Appliances' },
      { ...stored, id: 'c', name: 'AC', category: 'Appliances' },
    ]);
    expect(groups.map(([category]) => category)).toEqual(['Appliances', 'Bulk Staples', 'Home']);
    expect(groups[0][1].map((s) => s.name)).toEqual(['AC', 'Geyser']);
  });
});

describe('parseIndicativePrice', () => {
  it('reads whole rupees, treats empty as "no price", and refuses anything else', () => {
    expect(parseIndicativePrice('₹1,499')).toBe(1499);
    expect(parseIndicativePrice(' ')).toBeNull();
    expect(parseIndicativePrice('12.5')).toBeUndefined();
    expect(parseIndicativePrice('-3')).toBeUndefined();
  });

  it('refuses a price past the cap — an extra zero must not reach a 32-bit column', () => {
    expect(parseIndicativePrice(String(INDICATIVE_PRICE_MAX))).toBe(INDICATIVE_PRICE_MAX);
    expect(parseIndicativePrice('30,00,00,00,000')).toBeUndefined();
  });
});
