import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Card, CardTitle, CardDescription, CardEyebrow } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { Fact } from './fact';
import { Input } from './input';
import { Label } from './label';
import { Monogram } from './monogram';
import { Skeleton } from './skeleton';
import { StatCard } from './stat';
import { DataCell, RowSurface } from './data-rows';
import { Field } from './field';
import { Icon } from './icon';
import { Notice } from './notice';
import { PageHeader } from './page-header';
import { Select } from './select';

/**
 * BUG-007 — a primitive's base class and a caller's `className` silently fight.
 *
 * `cn` is a plain join, not tailwind-merge: when both set the same CSS property,
 * BOTH land and the winner is whichever Tailwind happened to emit last. No render
 * test can see it (jsdom applies no CSS) and the built-CSS gate cannot either (both
 * classes resolve to a real rule) — so the only way to catch it is to compare what a
 * primitive renders against what its callers ask for.
 *
 * It reads the classes each primitive ACTUALLY renders, rather than a list of classes
 * someone maintains — but WHICH primitives it renders is a list, and that list silently
 * stopped covering `Notice` the day it was written (V2 P2-5). The first test below now
 * fails when a component in this folder appears in neither `PRIMITIVES` nor
 * `NO_CLASSNAME`, so the gap closes itself rather than waiting for a reviewer.
 */

/** Which CSS property a Tailwind class sets — only the families that can collide. */
function familyOf(token: string): string | null {
  // A variant-prefixed class (`md:gap-5`, `hover:bg-white/60`) is a CONDITIONAL
  // override and lands in a later block, so it cannot be silently beaten by a base
  // class. Only unconditional ones can fight.
  if (token.includes(':')) return null;
  const bare = token;
  if (/^-?p-(\[|\d)/.test(bare)) return 'padding';
  if (/^-?p[xytrbl]-(\[|\d)/.test(bare)) return `padding-${bare[1]}`;
  if (/^-?m-(\[|\d)/.test(bare)) return 'margin';
  if (/^gap-(\[|\d)/.test(bare)) return 'gap';
  if (/^rounded(-|$)/.test(bare) && !/^rounded-(t|r|b|l|tl|tr|br|bl)/.test(bare)) return 'radius';
  if (/^(flex|grid|block|inline-flex|inline-block|inline|hidden|contents)$/.test(bare)) return 'display';
  // text-* is a size only when it names one; text-ink / text-white are colour.
  if (/^text-\[\d/.test(bare)) return 'font-size';
  if (/^text-(xs|sm|base|lg|xl|[2-9]xl|eyebrow|label|micro|meta|caption|body|lead|title|headline|display|amount|hero)$/.test(bare)) {
    return 'font-size';
  }
  // A side-specific border sets its own property and cannot fight an all-round one.
  if (/^border-(t|r|b|l|x|y|tl|tr|br|bl)(-|$)/.test(bare)) return null;
  if (/^border(-(\[|\d))?$/.test(bare)) return 'border-width';
  // `emphasis` moved both of these into a primitive's base (CHORE-014), and nothing
  // was watching either family: a caller could hand `Input` back the exact
  // `border-white/70 shadow-ring` pair the change existed to remove (V2 P2-6).
  if (/^border-/.test(bare)) return 'border-color';
  if (/^shadow(-|$)/.test(bare)) return 'box-shadow';
  return null;
}

/** The classes a primitive renders when the caller passes none. */
function baseClassesOf(element: ReactElement): string[] {
  const { container } = render(element);
  const node = container.firstElementChild;
  // `getAttribute`, not `.className`: on an SVG element that property is an
  // SVGAnimatedString, and reading it as a string threw the moment `Icon` was added.
  return (node?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

/**
 * Where a primitive lets a caller take a property over explicitly, the base is not
 * emitted and there is nothing to fight. `Card padding="none"` is the one such
 * escape hatch today; `size`/`textSize`/`radius` REPLACE the base, so a className in
 * those families is still a conflict and is still flagged.
 */
const OPT_OUT: Record<string, Record<string, RegExp>> = {
  Card: { padding: /padding="none"/ },
};

/** Each primitive, rendered with no className, keyed by the JSX tag callers write. */
const PRIMITIVES: Array<[string, ReactElement]> = [
  ['Card', <Card key="c">x</Card>],
  ['CardTitle', <CardTitle key="ct">x</CardTitle>],
  ['CardDescription', <CardDescription key="cd">x</CardDescription>],
  ['CardEyebrow', <CardEyebrow key="ce">x</CardEyebrow>],
  ['Badge', <Badge key="b">x</Badge>],
  ['Button', <Button key="bt">x</Button>],
  ['Input', <Input key="i" />],
  ['Label', <Label key="l">x</Label>],
  ['Skeleton', <Skeleton key="s" />],
  ['Monogram', <Monogram key="m" name="Priya Sharma" />],
  ['StatCard', <StatCard key="sc" label="Open" value="4" />],
  ['EmptyState', <EmptyState key="e" icon="users" title="t" description="d" />],
  ['RowSurface', <RowSurface key="rs">x</RowSurface>],
  ['DataCell', <DataCell key="dc" label="Units" value="4" />],
  ['Fact', <Fact key="f" term="Pledge" value="2 rooms" />],
  ['Notice', <Notice key="n" tone="error">x</Notice>],
  ['Select', <Select key="sel" />],
  ['PageHeader', <PageHeader key="ph" title="t" />],
  ['Field', <Field key="fd" label="Status">{(props) => <Select {...props} />}</Field>],
  ['Icon', <Icon key="ic" name="users" />],
];

/**
 * Components in this folder that take no `className` at all, with the reason. A caller
 * cannot fight a base class it has no way to pass, so these need no entry above — but
 * they DO need to be named here, or the coverage test cannot tell "deliberately out of
 * scope" from "nobody remembered".
 */
const NO_CLASSNAME: Record<string, string> = {
  AmbientGround: 'decorative, fixed-position; takes only an id',
  Toast: 'rendered by the toast host, never written by a caller with classes',
  StarGlyph: 'a raw glyph inside Rating; its className is the caller-owned fill colour only',
  CardHeader: 'layout-only wrapper with a fixed shape',
  SkeletonScreen: 'takes className but only as a caller-owned container; it renders none of its own',
  DataRows: 'takes no className; the row primitives carry the shape',
  DataRow: 'composed of RowSurface + DataCell, both covered above',
};

function appSources(dir = join(process.cwd(), 'src'), out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) appSources(path, out);
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) out.push(path);
  }
  return out;
}

/**
 * The whole opening tag for `<Name`, brace- and quote-aware — `[^>]*` stops at the
 * first `>` and would miss a `p-4` that sits after `action={<Icon />}`.
 */
function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  const opener = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  for (const match of source.matchAll(opener)) {
    let i = match.index! + match[0].length;
    let depth = 0;
    let quote: string | null = null;
    while (i < source.length) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
      } else if (ch === '>' && depth === 0) {
        break;
      }
      i += 1;
    }
    tags.push(source.slice(match.index!, i));
  }
  return tags;
}

/** Where an attribute of THIS tag starts — brace depth 0, outside any string. */
function ownAttributeIndex(tag: string, attribute: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < tag.length; i += 1) {
    const ch = tag[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (depth === 0 && tag.startsWith(attribute, i)) return i;
  }
  return -1;
}

/**
 * The tokens of a tag's OWN className — not every string in the tag. An `action={<Link
 * className="…" />}` prop carries someone else's classes, and counting those made the
 * scan blame the wrong component.
 */
function classNameTokens(tag: string): string[] {
  // The FIRST `className=` in the tag can belong to a nested element
  // (`action={<Link className="…" />}`), so take the one at this tag's own depth.
  const at = ownAttributeIndex(tag, 'className=');
  if (at === -1) return [];
  let i = at + 'className='.length;
  const tokens: string[] = [];
  if (tag[i] === '"' || tag[i] === "'") {
    const quote = tag[i];
    const end = tag.indexOf(quote, i + 1);
    return tag.slice(i + 1, end).split(/\s+/).filter(Boolean);
  }
  if (tag[i] !== '{') return [];
  // className={cn('a b', x && 'c')} — every literal inside the balanced braces.
  let depth = 0;
  const start = i;
  for (; i < tag.length; i += 1) {
    if (tag[i] === '{') depth += 1;
    else if (tag[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const expression = tag.slice(start, i + 1);
  // [, , quoted]: group 1 is the quote character, group 2 is the contents.
  for (const [, , quoted] of expression.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/gs)) {
    tokens.push(...quoted.split(/\s+/).filter(Boolean));
  }
  return tokens;
}

/** Every component exported from a non-test module in this folder. */
function exportedComponents(): Array<[string, string]> {
  const dir = join(process.cwd(), 'src/components/ui');
  const found: Array<[string, string]> = [];
  for (const entry of readdirSync(dir)) {
    if (!/\.tsx$/.test(entry) || /\.test\.tsx$/.test(entry)) continue;
    const source = readFileSync(join(dir, entry), 'utf8');
    for (const [, name] of source.matchAll(/export (?:function|const) ([A-Z]\w*)/g)) {
      found.push([name, entry]);
    }
  }
  return found;
}

describe('BUG-007 — a caller must not fight a primitive for the same CSS property', () => {
  const bases = new Map(PRIMITIVES.map(([name, element]) => [name, baseClassesOf(element)]));

  // V2 P2-5: the scan's own doc comment claimed a primitive written tomorrow was
  // covered the day it existed. It was not — `PRIMITIVES` is a list, and `Notice`
  // was missing from it. This is what makes the claim true.
  it('covers every component in components/ui', () => {
    const components = exportedComponents();
    expect(components.length, 'found no components to check — this test is vacuous').toBeGreaterThan(15);

    const uncovered = components
      .filter(([name]) => !bases.has(name) && !(name in NO_CLASSNAME))
      .map(([name, file]) => `${name} (${file}) is in neither PRIMITIVES nor NO_CLASSNAME`);
    expect(uncovered).toEqual([]);
  });

  it('every primitive renders at least one class, or this scan proves nothing', () => {
    for (const [name, classes] of bases) {
      expect(classes.length, `${name} rendered no classes — the scan below is vacuous`).toBeGreaterThan(0);
    }
  });

  it('no caller passes a class in the same family as a base class', () => {
    const offenders: string[] = [];
    let inspected = 0;
    for (const file of appSources()) {
      const source = readFileSync(file, 'utf8');
      for (const [name, baseClasses] of bases) {
        const baseFamilies = new Set(baseClasses.map(familyOf).filter(Boolean) as string[]);
        if (baseFamilies.size === 0) continue;
        for (const tag of openingTags(source, name)) {
          const tokens = classNameTokens(tag);
          inspected += tokens.length;
          for (const token of tokens) {
            const family = familyOf(token);
            const optedOut = family ? OPT_OUT[name]?.[family]?.test(tag) : false;
            if (family && baseFamilies.has(family) && !optedOut) {
              const line = source.slice(0, source.indexOf(tag)).split('\n').length;
              offenders.push(
                `${file.replace(process.cwd(), '')}:${line} <${name} className="… ${token} …"> fights its base ${family}`,
              );
            }
          }
        }
      }
    }
    // A scan that inspects nothing passes forever. This one says how much it looked
    // at, and fails if that collapses.
    expect(inspected, 'the scan stopped seeing className tokens').toBeGreaterThan(150);
    expect(offenders).toEqual([]);
  });
});
