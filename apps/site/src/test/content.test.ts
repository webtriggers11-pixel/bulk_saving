/**
 * AC3 / ADR-0039 §3: the page can never sell what is not shipped. The registry is the oracle.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { audiences, catalog, features, featuresIn, internalFeatures, roadmap, sections } from '../content/features';

const here = fileURLToPath(new URL('.', import.meta.url));
const registry = readFileSync(`${here}/../../../../loop/REGISTRY.md`, 'utf8');

/** FEAT rows: id → status, from the table (`| FEAT-NNN | title | status | ...`). */
const registryFeats = new Map<string, string>();
for (const line of registry.split('\n')) {
  const m = /^\|\s*(FEAT-\d{3})\s*\|[^|]*\|\s*([^|]+?)\s*\|/.exec(line);
  if (m) registryFeats.set(m[1]!, m[2]!);
}

describe('features.ts against loop/REGISTRY.md', () => {
  it('parsed the registry', () => {
    expect(registryFeats.size).toBeGreaterThan(20);
  });

  it('every FEAT the site names exists in the registry, and internal ones are not named', () => {
    for (const f of features) expect(registryFeats.has(f.id), f.id).toBe(true);
    for (const f of features) expect(internalFeatures.has(f.id), `${f.id} is internal tooling`).toBe(false);
  });

  it('every done FEAT in the registry appears on the site, except the site itself and internal tooling', () => {
    const missing = [...registryFeats]
      .filter(([id, status]) => status.startsWith('done') && id !== 'FEAT-028' && !internalFeatures.has(id))
      .map(([id]) => id)
      .filter((id) => !features.some((f) => f.id === id));
    expect(missing).toEqual([]);
  });

  it('nothing marked done on the site is not done in the registry, and nothing "coming soon" is done', () => {
    for (const f of features) {
      const status = registryFeats.get(f.id) ?? '';
      if (f.status === 'done') expect(status, `${f.id} is "${status}" in the registry`).toMatch(/^done/);
      if (f.status === 'coming-soon') expect(status, `${f.id} is done; drop the "coming soon"`).not.toMatch(/^done/);
    }
  });

  it('no feature is listed twice, every section has at least one, every feature has a section', () => {
    const ids = features.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sections) expect(featuresIn(s.id).length, s.id).toBeGreaterThan(0);
    for (const f of features) expect(sections.some((s) => s.id === f.section), f.id).toBe(true);
  });

  it('copy stays short and in the visitor’s words', () => {
    for (const f of features) {
      expect(f.title.length, f.id).toBeLessThanOrEqual(60);
      expect(f.what.length, f.id).toBeLessThanOrEqual(320);
      expect(f.why.length, f.id).toBeLessThanOrEqual(220);
      expect(f.what + f.why, `${f.id} mentions internals`).not.toMatch(/\b(Prisma|BullMQ|Redis|Postgres|JWT|DTO|NestJS)\b/);
    }
    for (const r of roadmap) expect(r.what.length).toBeLessThanOrEqual(220);
  });

  it('roadmap and audiences are complete and positive', () => {
    expect(roadmap.filter((r) => r.when === 'Now').length).toBeGreaterThan(0);
    expect(roadmap.filter((r) => r.when === 'Next').length).toBeGreaterThan(0);
    expect(roadmap.filter((r) => r.when === 'Later').length).toBeGreaterThan(0);
    expect(audiences.map((a) => a.key)).toEqual(['residents', 'societies', 'vendors', 'operator']);
    for (const a of audiences) expect(a.points.length).toBe(3);
    for (const r of roadmap) expect(r.what, r.title).not.toMatch(/\b(not in v1|non-goal|do not|never)\b/i);
  });

  it('the catalog ticker names the 23 seeded services across six categories', () => {
    expect(catalog.length).toBe(23);
    expect(new Set(catalog.map((c) => c.category)).size).toBe(6);
    expect(new Set(catalog.map((c) => c.name)).size).toBe(23);
  });
});
