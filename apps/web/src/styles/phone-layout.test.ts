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

  it('cards use 18px or 22px padding — nothing in between, and no padding presets', () => {
    const odd = resident.flatMap((f) => {
      const source = readFileSync(f, 'utf8');
      const arbitrary = [...source.matchAll(/\bp-\[(\d+)px\]/g)].filter((m) => !['18', '22'].includes(m[1]));
      // Token paddings on a card surface, and Card presets (16/20/24/28px), slipped past the
      // arbitrary-value check (V2 P3-2).
      const tokens = [...source.matchAll(/(?:surface-(?:solid|glass|tint|accent)[^"]*\bp-[4-7]\b|<Card[^>]*\bp-[4-7]\b|padding="(?:tight|snug|default|roomy)")/g)];
      return [...arbitrary, ...tokens].map((m) => `${f.replace(process.cwd(), '')}: ${m[0].slice(0, 60)}`);
    });
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
    // Token sizes too: h-12 w-12 (48px) on a non-lead card slipped past (V2 P3-2).
    const tokens = resident.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/\bh-(10|12|13|14) w-\1\b/g)].map((m) => `${f.replace(process.cwd(), '')}: ${m[0]}`),
    );
    expect([...odd, ...tokens]).toEqual([]);
  });

  it('tiles side by side top-align their labels, so a wrapped value never lifts its own', () => {
    // Positive: the label sits at a fixed distance under the icon (V2 P3-2 — rejecting only
    // the old string let `mt-auto pt-4` through).
    expect(src('profile/ProfilePage.tsx')).toMatch(/<p className="mt-4 term-label">/);
    expect(src('home/HomePage.tsx')).toMatch(/<CardEyebrow className="mt-4">Your society<\/CardEyebrow>/);
  });

  it('fact tiles push their value to the bottom, so values in a row line up', () => {
    const fact = readFileSync(join(process.cwd(), 'src/components/ui/fact.tsx'), 'utf8');
    expect(fact).toMatch(/rounded-inset flex flex-col px-3\.5 py-3/);
    expect(fact).toMatch(/num mt-auto pt-1\.5/);
  });
});

describe('BUG-016 V2 — the pieces a phone layout depends on', () => {
  it('service tiles span the row below 400px and sit 2-up above', () => {
    expect(src('catalog/ServicesPage.tsx')).toContain("'col-span-2 min-[400px]:col-span-1'");
  });

  it('from 400px, a tile reserves two lines for title, description and scope so prices line up', () => {
    const tile = src('catalog/ServicesPage.tsx').split('function ServiceTile')[1].split('\n}\n')[0];
    expect(tile.match(/min-\[400px\]:min-h-\[2lh\]/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('a Home group-buy row truncates its name and never wraps its price (FEAT-023)', () => {
    const lead = src('home/GroupBuysLead.tsx');
    expect(lead).toMatch(/block truncate text-body font-extrabold/);
    expect(lead).toMatch(/num shrink-0 whitespace-nowrap/);
  });

  it('the countdown and its arrow break as one piece', () => {
    expect(src('catalog/ServicesPage.tsx')).toMatch(/<span className="inline-flex items-center gap-1 whitespace-nowrap">\s*\{formatCountdown/);
  });

  it('the admin nav is a scrolling rail on a phone that keeps the current page in view and its focus ring uncut', () => {
    const layout = src('admin/AdminLayout.tsx');
    expect(layout).toMatch(/chip-rail snap-none[^"]*overflow-x-auto[^"]*py-1\.5/);
    expect(layout).toContain('scrollIntoRail(rail.current, active)');
    expect(layout).toContain('focus-visible:shadow-focus');
  });
});
