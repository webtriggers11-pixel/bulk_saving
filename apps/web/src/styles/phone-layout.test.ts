import { readFileSync } from 'node:fs';
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
    expect(src('requests/MyRequestsPage.tsx')).toMatch(/grid-cols-\[repeat\(auto-fit,minmax\(7rem,1fr\)\)\][^"]*" data-testid="my-facts"/);
  });

  it('a saved rating wraps its stars and its buttons', () => {
    expect(src('rating/RateRound.tsx')).toMatch(/flex flex-wrap items-center justify-between gap-3" data-testid="rating-saved-row"/);
  });
});
