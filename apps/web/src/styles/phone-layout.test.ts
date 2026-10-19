import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * BUG-015 — phone-width layout guards. jsdom does no layout, so these pin the STRUCTURE
 * that keeps three screens readable at 360px; the widths themselves were measured in a
 * real browser (LOG, 2026-10-19). A change here should be re-measured the same way.
 */
const src = (p: string) => readFileSync(join(process.cwd(), 'src/features', p), 'utf8');

describe('phone layout (BUG-015)', () => {
  it('a service row keeps its price under the text, not in a fixed column beside it', () => {
    const row = src('catalog/ServicesPage.tsx').split('function ServiceRow')[1].split('\n}\n')[0];
    expect(row).not.toMatch(/PriceLine[^>]*shrink-0/);
    const textColumn = row.slice(row.indexOf('min-w-0 flex-1'), row.indexOf('RoundStatus'));
    expect(textColumn).toContain('<PriceLine');
  });

  it('the facts on a request card wrap instead of overflowing', () => {
    expect(src('requests/MyRequestsPage.tsx')).toMatch(/grid-cols-\[repeat\(auto-fit,minmax\(7rem,1fr\)\)\][^"]*"\s*data-testid="my-facts"/);
  });

  it('the ask line may shrink to a narrow tile — its 9rem is a basis, never a minimum (V2 P1)', () => {
    const line = src('catalog/ServicesPage.tsx').match(/<p className="([^"]*)" data-testid="service-demand">/)?.[1] ?? '';
    expect(line).toContain('min-w-0');
    expect(line).not.toMatch(/min-w-\[/);
  });

  it('the super-admin entry on Home wraps its button below the title', () => {
    expect(src('home/HomePage.tsx')).toMatch(/col-span-2 flex flex-wrap items-center gap-4 p-\[18px\]" data-testid="admin-entry"/);
  });

  it('a saved rating wraps its stars and its buttons', () => {
    expect(src('rating/RateRound.tsx')).toMatch(/flex flex-wrap items-center justify-between gap-3" data-testid="rating-saved-row"/);
  });
});

/**
 * BUG-016 — consistency across the platform, as rules a new screen cannot quietly break.
 * Resident screens use two card paddings (22px lead cards, 18px everything else) and one
 * icon-box size for rows and tiles (44px); only lead cards carry a 52px mark.
 */
describe('one platform, one rhythm (BUG-016)', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return files(path);
      return /\.tsx$/.test(entry) && !/\.test\./.test(entry) ? [path] : [];
    });
  const resident = files(join(process.cwd(), 'src/features')).filter((f) => !f.includes('/admin/'));

  it('cards use 18px or 22px padding — nothing in between', () => {
    const odd = resident.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/\bp-\[(\d+)px\]/g)]
        .filter((m) => !['18', '22'].includes(m[1]))
        .map((m) => `${f.replace(process.cwd(), '')}: ${m[0]}`),
    );
    expect(odd).toEqual([]);
  });

  it('row and tile icon boxes are 44px; only lead cards carry the 52px mark', () => {
    const LEAD = ['features/home/HomePage.tsx', 'features/home/HomeSkeleton.tsx'];
    const odd = resident.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/\bh-\[(\d+)px\] w-\[\1px\]/g)]
        .filter((m) => !(m[1] === '52' && LEAD.some((lead) => f.endsWith(lead))))
        .filter((m) => Number(m[1]) >= 40 && Number(m[1]) <= 56)
        .map((m) => `${f.replace(process.cwd(), '')}: ${m[0]}`),
    );
    expect(odd).toEqual([]);
  });

  it('tiles side by side top-align their labels, so a wrapped value never lifts its own', () => {
    expect(src('profile/ProfilePage.tsx')).not.toMatch(/mt-auto pt-3\.5 term-label/);
    expect(src('home/HomePage.tsx')).toMatch(/<CardEyebrow className="mt-4">Your society<\/CardEyebrow>/);
  });

  it('fact tiles push their value to the bottom, so values in a row line up', () => {
    const fact = readFileSync(join(process.cwd(), 'src/components/ui/fact.tsx'), 'utf8');
    expect(fact).toMatch(/rounded-inset flex flex-col px-3\.5 py-3/);
    expect(fact).toMatch(/num mt-auto pt-1\.5/);
  });
});
