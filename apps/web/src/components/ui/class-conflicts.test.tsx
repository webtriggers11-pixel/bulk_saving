import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Card, CardHeader, CardTitle, CardDescription, CardEyebrow } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { Fact } from './fact';
import { Input } from './input';
import { Label } from './label';
import { Monogram } from './monogram';
import { Skeleton, SkeletonScreen } from './skeleton';
import { StatCard } from './stat';
import { DataCell, DataRow, DataRows, RowSurface } from './data-rows';
import { Field } from './field';
import { Icon, StarGlyph } from './icon';
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
  // Both were unclassified while `Input`'s base set them AND its callers overrode them
  // on the two auth screens, so the OTP field asked for 64px/800 and rendered at
  // 50px/600 (V2 round 2, P2-D).
  if (/^h-(\[|\d|auto$|full$|screen$|control$|icon$|tab$)/.test(bare)) return 'height';
  if (/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(bare)) {
    return 'font-weight';
  }
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
  ['DataRows', <DataRows key="drs">x</DataRows>],
  ['DataRow', <DataRow key="dr" title="t" columns={<DataCell label="l" value="v" />} />],
  ['CardHeader', <CardHeader key="ch">x</CardHeader>],
  ['StarGlyph', <StarGlyph key="sg" filled />],
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
};

/**
 * Every combination of closed props a primitive offers, for the base-vs-base check.
 *
 * Rendering only the DEFAULT props is how `variant="link"` hid: the conflict is between
 * the link variant and the size block, and the default variant is `primary`, so nothing
 * ever rendered the pair that fights. A closed prop is a promise that each of its values
 * produces a coherent base, and each value has to be rendered to check that.
 */
const BUTTON_VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'link', 'danger'] as const;
const BUTTON_SIZES = ['md', 'sm', 'icon'] as const;
const INPUT_SIZES = ['default', 'numeric', 'lg', 'xl', 'code'] as const;
const INPUT_EMPHASES = ['normal', 'primary'] as const;

const PROP_MATRIX: Array<[string, ReactElement]> = [
  ...BUTTON_VARIANTS.flatMap((variant) =>
    BUTTON_SIZES.map(
      (size) =>
        [
          `Button variant=${variant} size=${size}`,
          <Button key={`${variant}-${size}`} variant={variant} size={size}>
            x
          </Button>,
        ] as [string, ReactElement],
    ),
  ),
  ...INPUT_SIZES.flatMap((textSize) =>
    INPUT_EMPHASES.map(
      (emphasis) =>
        [
          `Input textSize=${textSize} emphasis=${emphasis}`,
          <Input key={`${textSize}-${emphasis}`} textSize={textSize} emphasis={emphasis} />,
        ] as [string, ReactElement],
    ),
  ),
];

/**
 * The other way a component has nothing to fight: it ACCEPTS a `className` and renders
 * no classes of its own, so the caller's are the only ones on the element. Checked by
 * rendering it and asserting the base really is empty — the claim is not taken on
 * trust, because the last version of this list had four false entries out of seven.
 */
const NO_BASE_CLASSES: Array<[string, ReactElement]> = [
  ['SkeletonScreen', <SkeletonScreen key="ss" label="Loading">x</SkeletonScreen>],
];

/**
 * A component that renders no classes on its own outer element but forwards a caller's
 * `className` into another primitive's base. Checking it against its own (empty) base
 * would pass everything, while the caller's classes really do land next to the target's
 * base — which is how a `<DataRows className="grid gap-8">` fighting `flex gap-2.5`
 * went unseen (V2 round 2, P2-B).
 */
const FORWARDS_TO: Record<string, string> = {
  DataRow: 'RowSurface',
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
  const rendered = new Map(PRIMITIVES.map(([name, element]) => [name, baseClassesOf(element)]));
  const bases = new Map(
    [...rendered].map(([name, classes]) => {
      const target = FORWARDS_TO[name];
      return [name, target ? (rendered.get(target) ?? classes) : classes] as const;
    }),
  );

  /**
   * V2 round 2, P2-B: the coverage test closed "nobody remembered" and opened "write a
   * sentence and the component is exempt" — four of seven exemptions were factually
   * wrong, three of them for components that plainly take a className. The claim is
   * now checked against the source instead of believed.
   */
  it('every NO_CLASSNAME entry really does refuse a className', () => {
    const dir = join(process.cwd(), 'src/components/ui');
    const liars: string[] = [];
    for (const name of Object.keys(NO_CLASSNAME)) {
      for (const entry of readdirSync(dir)) {
        if (!/\.tsx$/.test(entry) || /\.test\.tsx$/.test(entry)) continue;
        const source = readFileSync(join(dir, entry), 'utf8');
        const at = source.search(new RegExp(`export (?:function|const) ${name}\\b`));
        if (at === -1) continue;
        // Only the SIGNATURE — up to the `) {` that opens the body. A component that
        // uses `className` on its own inner elements is not the question; whether it
        // ACCEPTS one from a caller is.
        const rest = source.slice(at);
        const opens = rest.search(/\)\s*{/);
        const signature = opens === -1 ? rest.slice(0, 400) : rest.slice(0, opens);
        if (signature.includes('className')) {
          liars.push(`${name} (${entry}) is exempt as "${NO_CLASSNAME[name]}" but takes a className`);
        }
      }
    }
    expect(liars).toEqual([]);
  });

  it('every NO_BASE_CLASSES entry really does render no classes of its own', () => {
    const liars = NO_BASE_CLASSES.filter(([, element]) => baseClassesOf(element).length > 0).map(
      ([name]) => `${name} is exempt as having no base classes, but renders some`,
    );
    expect(liars).toEqual([]);
  });

  /**
   * V2 round 2, P2-C. `Button variant="link"` carried `h-auto px-0` in its variant AND
   * `h-control px-[22px]` from its size block, so every link button rendered 50px tall
   * with 22px of padding — decided by emission order, inside one primitive, with no
   * caller involved. P2-7 was the same shape; fixing the instance did not add the check.
   */
  it('no primitive emits two classes in one property family from its own base', () => {
    const offenders: string[] = [];
    for (const [name, classes] of [...rendered, ...PROP_MATRIX.map(
      ([label, element]) => [label, baseClassesOf(element)] as const,
    )]) {
      const seen = new Map<string, string>();
      for (const token of classes) {
        const family = familyOf(token);
        if (!family) continue;
        const first = seen.get(family);
        if (first) {
          offenders.push(`<${name}> base sets ${family} twice: "${first}" and "${token}"`);
        } else {
          seen.set(family, token);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // V2 P2-5: the scan's own doc comment claimed a primitive written tomorrow was
  // covered the day it existed. It was not — `PRIMITIVES` is a list, and `Notice`
  // was missing from it. This is what makes the claim true.
  it('covers every component in components/ui', () => {
    const components = exportedComponents();
    expect(components.length, 'found no components to check — this test is vacuous').toBeGreaterThan(15);

    const exempt = new Set(NO_BASE_CLASSES.map(([name]) => name));
    const uncovered = components
      .filter(([name]) => !bases.has(name) && !(name in NO_CLASSNAME) && !exempt.has(name))
      .map(([name, file]) => `${name} (${file}) is covered by no list in this file`);
    expect(uncovered).toEqual([]);
  });

  it('every primitive renders at least one class, or this scan proves nothing', () => {
    // `bases`, not `rendered`: a forwarding component's base is its target's.
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
