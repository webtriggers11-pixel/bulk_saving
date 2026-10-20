/**
 * The site's catalog is the app's catalog: every price and unit noun on the wall must match
 * apps/backend/prisma/seed.ts, matched by slug. Names are the site's wording (sentence case,
 * "Doorstep car wash"); prices and nouns are not negotiable.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { catalog } from '../content/features';

const here = fileURLToPath(new URL('.', import.meta.url));
const seed = readFileSync(`${here}/../../../backend/prisma/seed.ts`, 'utf8');

interface Row {
  slug: string;
  price: number;
  unit: string;
  units: string;
  category: string;
}
const rows = new Map<string, Row>();
// The five object rows: name / slug / … / category / indicativePrice / unitLabel / unitLabelPlural.
for (const m of seed.matchAll(/slug: '([^']+)'[\s\S]*?category: '([^']+)'[\s\S]*?indicativePrice: (\d+)[\s\S]*?unitLabel: '([^']+)'[\s\S]*?unitLabelPlural: '([^']+)'/g)) {
  rows.set(m[1]!, { slug: m[1]!, category: m[2]!, price: Number(m[3]), unit: m[4]!, units: m[5]! });
}
// The eighteen tuples: [name, slug, description, category, price, unit, unitPlural, scope].
for (const m of seed.matchAll(/\['[^']*', '([^']+)', '[^']*', '([^']+)', (\d+), '([^']+)', '([^']+)', '[^']*'\]/g)) {
  rows.set(m[1]!, { slug: m[1]!, category: m[2]!, price: Number(m[3]), unit: m[4]!, units: m[5]! });
}

describe('catalog vs apps/backend/prisma/seed.ts', () => {
  it('parsed all 23 seeded services', () => {
    expect(rows.size).toBe(23);
  });
  it('every card carries the seed\u2019s price, unit nouns and category', () => {
    const drift: string[] = [];
    for (const c of catalog) {
      const r = rows.get(c.slug);
      if (!r) {
        drift.push(`${c.name}: slug ${c.slug} not in the seed`);
        continue;
      }
      if (r.price !== c.price) drift.push(`${c.name}: price ${c.price} ≠ seed ${r.price}`);
      if (r.unit !== c.unit || r.units !== c.units) drift.push(`${c.name}: units ${c.unit}/${c.units} ≠ seed ${r.unit}/${r.units}`);
      if (r.category !== c.category) drift.push(`${c.name}: category ${c.category} ≠ seed ${r.category}`);
    }
    expect(drift).toEqual([]);
    expect(new Set(catalog.map((c) => c.slug)).size).toBe(23);
  });
  it('every demo round starts at the seed price (tier 1) and ends lower', () => {
    for (const c of catalog) {
      if (!c.round) continue;
      expect(c.round.tiers[0]?.units, c.name).toBe(1);
      expect(c.round.tiers[0]?.price, c.name).toBe(c.price);
      const last = c.round.tiers[c.round.tiers.length - 1]!;
      expect(last.price, c.name).toBeLessThan(c.price);
      expect(last.units, c.name).toBe(c.round.target);
    }
  });
});
