import { describe, expect, it } from 'vitest';
// The class gate's extractor (scripts/check-css-classes.mjs runs it over every source file).
import { classLists } from '../../../../scripts/class-lists.mjs';

/**
 * BUG-012 — the class gate must read every class list in a file, whatever else the file
 * contains. It used to find strings by pairing quote characters across the whole file, so
 * one apostrophe in a comment shifted the pairing: everything after it was read as the
 * wrong strings, and real class lists went unchecked (HomePage: 0 of 32 read).
 */
const lists = (source: string) => classLists(source).map((tokens: string[]) => tokens.join(' '));

describe('class gate extractor (BUG-012)', () => {
  it('an apostrophe in a comment does not hide the class lists after it', () => {
    const source = `
      // the resident's own card
      export const A = () => <div className="flex gap-2 p-[18px]" />;
      /* don't move this */
      export const B = () => <span className="text-meta font-bold" />;
    `;
    expect(lists(source)).toEqual(['flex gap-2 p-[18px]', 'text-meta font-bold']);
  });

  it('an apostrophe in JSX text does not either', () => {
    const source = `
      export const A = () => <p className="mt-1 text-ink">It's open</p>;
      export const B = () => <p className="mt-2 text-ink-muted">Don't wait</p>;
    `;
    expect(lists(source)).toEqual(['mt-1 text-ink', 'mt-2 text-ink-muted']);
  });

  it('still finds lists in plain strings, variant maps and single system classes', () => {
    const source = `
      const VARIANTS = { primary: 'paint-brand text-on-fill border', ghost: "border-transparent text-ink-muted" };
      const SURFACE = 'surface-glass';
      const autocomplete = 'one-time-code';
      const prose = 'Loading rounds…';
      const label = 'Sign-in progress';
    `;
    expect(lists(source)).toEqual(['paint-brand text-on-fill border', 'border-transparent text-ink-muted', 'surface-glass']);
  });
});
