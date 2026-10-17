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
import { FilterChips } from './filter-chips';
import { SearchField } from './search-field';
import { Switch } from './switch';
import { ResultSummary } from './result-summary';

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

/**
 * Which CSS PROPERTIES a Tailwind class sets — only the families that can collide.
 *
 * A list, not one value, because a shorthand and a per-axis utility are the same
 * property seen from different angles: `p-6` and `px-4` were two different keys, so a
 * caller's `px-4` beating a base's `p-6` on the horizontal axis (and losing on the
 * vertical) was invisible — a property split between base and caller, decided by
 * emission order, which is the whole of BUG-007 (V2 round 4). Anything that resolves
 * to overlapping properties now collides.
 */
function familiesOf(token: string): string[] {
  // A variant-prefixed class (`md:gap-5`, `hover:bg-white/60`) is a CONDITIONAL
  // override and lands in a later block, so it cannot be silently beaten by a base
  // class. Only unconditional ones can fight.
  if (token.includes(':')) return [];
  const bare = token;

  /** `p`/`m` → the four edges a shorthand or axis utility actually writes. */
  function edges(prefix: 'padding' | 'margin', axis: string): string[] {
    const sides =
      axis === '' ? ['t', 'r', 'b', 'l'] : axis === 'x' ? ['l', 'r'] : axis === 'y' ? ['t', 'b'] : [axis];
    return sides.map((side) => `${prefix}-${side}`);
  }

  const spacing = /^-?([pm])([xytrbl]?)-(\[|\d|auto$)/.exec(bare);
  if (spacing) {
    return edges(spacing[1] === 'p' ? 'padding' : 'margin', spacing[2]);
  }

  if (/^gap-(\[|\d)/.test(bare)) return ['gap'];
  if (/^rounded(-|$)/.test(bare) && !/^rounded-(t|r|b|l|tl|tr|br|bl)/.test(bare)) return ['radius'];
  if (/^(flex|grid|block|inline-flex|inline-block|inline|hidden|contents)$/.test(bare)) return ['display'];
  // text-* is a size only when it names one; text-ink / text-white are colour.
  if (/^text-\[\d/.test(bare)) return ['font-size'];
  if (/^text-(xs|sm|base|lg|xl|[2-9]xl|eyebrow|label|micro|meta|caption|body|lead|title|headline|display|amount|hero)$/.test(bare)) {
    return ['font-size'];
  }
  // A side-specific border sets its own property and cannot fight an all-round one.
  if (/^border-(t|r|b|l|x|y|tl|tr|br|bl)(-|$)/.test(bare)) return [];
  if (/^border(-(\[|\d))?$/.test(bare)) return ['border-width'];
  if (/^border-/.test(bare)) return ['border-color'];
  if (/^shadow(-|$)/.test(bare)) return ['box-shadow'];
  if (/^h-(\[|\d|auto$|full$|screen$|control$|icon$|tab$)/.test(bare)) return ['height'];
  // `Input` and `Select` both set `w-full`; a caller passing `w-auto` is making a
  // sizing decision, which has the same "neither of them decides it" character height
  // had. Deliberately NOT extended to colour families, where a caller legitimately
  // overrides and flagging it would only train people to ignore the scan.
  if (/^w-(\[|\d|auto$|full$|fit$|screen$|icon$)/.test(bare)) return ['width'];
  // CHORE-012: letter-spacing and line-height were unpoliced, and Input's base
  // `tracking-[-0.01em]` was fighting three callers' `tracking-[0.26em|0.38em]` —
  // the callers won only because Tailwind happened to emit them later.
  if (/^-?tracking-/.test(bare)) return ['letter-spacing'];
  if (/^leading-/.test(bare)) return ['line-height'];
  if (/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(bare)) {
    return ['font-weight'];
  }
  return [];
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
const OPT_OUT: Record<string, Array<{ family: RegExp; when: RegExp }>> = {
  // Keyed by a family PATTERN, because one `p-*` class now resolves to four edges —
  // an opt-out keyed on the single name `padding` silently stopped matching any of
  // them the moment the classifier started returning property sets.
  Card: [{ family: /^padding-/, when: /padding="none"/ }],
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
  // FEAT-015 filtering primitives. FilterChips renders a chosen and an unchosen chip
  // here, so both of its branches are scanned.
  ['SearchField', <SearchField key="sf" value="x" onChange={() => {}} label="Search" />],
  [
    'FilterChips',
    <FilterChips
      key="fc"
      label="Category"
      value=""
      onChange={() => {}}
      options={[
        { value: '', label: 'All' },
        { value: 'a', label: 'A' },
      ]}
    />,
  ],
  ['Switch', <Switch key="sw" checked={false} onChange={() => {}} label="Active" text="Inactive" />],
  ['ResultSummary', <ResultSummary key="rsum" count={2} noun={['row', 'rows']} activeCount={1} onClear={() => {}} />],
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
  SavedTick: 'a fixed confirmation chip; placement is its parent\'s job',
  Sheet: 'a portal-rendered modal; its content brings its own layout',
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
const INPUT_INSETS = ['default', 'icons'] as const;
const INPUT_TRACKINGS = ['default', 'invite', 'code'] as const;

const CARD_SURFACES = ['glass', 'solid', 'tint', 'accent'] as const;
const CARD_PADDING = ['none', 'tight', 'snug', 'default', 'roomy'] as const;
const CARD_TITLE_SIZES = ['sm', 'md', 'lg', 'xl', '2xl'] as const;
const STAT_EMPHASES = ['lead', 'normal', 'quiet', 'alert'] as const;
const BADGE_TONES = ['slate', 'teal', 'amber', 'blue', 'green', 'red'] as const;
const SKELETON_RADII = ['full', 'chip', 'control', 'inset', 'tile', 'card'] as const;

const PROP_MATRIX: Array<[string, ReactElement]> = [
  // `tone` is the prop added in the round that introduced this matrix, and it was the
  // one prop the matrix left out — the same shape as `variant="link"` hiding behind
  // default props, one level along (V2 round 3).
  ...(['secondary', 'ghost'] as const).flatMap((variant) =>
    BUTTON_SIZES.map(
      (size) =>
        [
          `Button variant=${variant} size=${size} tone=onAccent`,
          <Button key={`t-${variant}-${size}`} variant={variant} size={size} tone="onAccent">
            x
          </Button>,
        ] as [string, ReactElement],
    ),
  ),
  ...CARD_SURFACES.flatMap((surface) =>
    CARD_PADDING.flatMap((padding) =>
      [true, false].map(
        (interactive) =>
          [
            `Card surface=${surface} padding=${padding} interactive=${interactive}`,
            <Card
              key={`${surface}-${padding}-${interactive}`}
              surface={surface}
              padding={padding}
              interactive={interactive}
            >
              x
            </Card>,
          ] as [string, ReactElement],
      ),
    ),
  ),
  ...CARD_TITLE_SIZES.map(
    (size) =>
      [`CardTitle size=${size}`, <CardTitle key={`ct-${size}`} size={size}>x</CardTitle>] as [
        string,
        ReactElement,
      ],
  ),
  ...(['caption', 'meta'] as const).map(
    (size) =>
      [
        `CardDescription size=${size}`,
        <CardDescription key={`cd-${size}`} size={size}>x</CardDescription>,
      ] as [string, ReactElement],
  ),
  ...STAT_EMPHASES.flatMap((emphasis) =>
    (['normal', 'dense'] as const).map(
      (density) =>
        [
          `StatCard emphasis=${emphasis} density=${density}`,
          <StatCard key={`${emphasis}-${density}`} label="l" value="v" emphasis={emphasis} density={density} />,
        ] as [string, ReactElement],
    ),
  ),
  ...(['tile', 'row', 'plain'] as const).map(
    (variant) =>
      [`Fact variant=${variant}`, <Fact key={`f-${variant}`} term="t" value="v" variant={variant} />] as [
        string,
        ReactElement,
      ],
  ),
  ...BADGE_TONES.map(
    (tone) => [`Badge tone=${tone}`, <Badge key={`b-${tone}`} tone={tone}>x</Badge>] as [string, ReactElement],
  ),
  ...(['sm', 'md', 'lg'] as const).map(
    (size) =>
      [`Monogram size=${size}`, <Monogram key={`m-${size}`} name="Priya Sharma" size={size} />] as [
        string,
        ReactElement,
      ],
  ),
  ...(['error', 'warn'] as const).map(
    (tone) => [`Notice tone=${tone}`, <Notice key={`n-${tone}`} tone={tone}>x</Notice>] as [string, ReactElement],
  ),
  ...SKELETON_RADII.flatMap((radius) =>
    ([0, 1, 2, 3] as const).map(
      (delay) =>
        [
          `Skeleton radius=${radius} delay=${delay}`,
          <Skeleton key={`s-${radius}-${delay}`} radius={radius} delay={delay} />,
        ] as [string, ReactElement],
    ),
  ),
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
    INPUT_EMPHASES.flatMap((emphasis) =>
      INPUT_INSETS.flatMap((inset) =>
        INPUT_TRACKINGS.map(
          (tracking) =>
            [
              `Input textSize=${textSize} emphasis=${emphasis} inset=${inset} tracking=${tracking}`,
              <Input
                key={`${textSize}-${emphasis}-${inset}-${tracking}`}
                textSize={textSize}
                emphasis={emphasis}
                inset={inset}
                tracking={tracking}
              />,
            ] as [string, ReactElement],
        ),
      ),
    ),
  ),
  ...[true, false].map(
    (checked) =>
      [
        `Switch checked=${checked}`,
        <Switch key={`sw-${checked}`} checked={checked} onChange={() => {}} label="x" text="x" />,
      ] as [string, ReactElement],
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
function openingTags(source: string, name: string): Array<{ tag: string; at: number }> {
  const tags: Array<{ tag: string; at: number }> = [];
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
    tags.push({ tag: source.slice(match.index!, i), at: match.index! });
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
        for (const family of familiesOf(token)) {
          const first = seen.get(family);
          if (first) {
            offenders.push(`<${name}> base sets ${family} twice: "${first}" and "${token}"`);
          } else {
            seen.set(family, token);
          }
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
        const baseFamilies = new Set(baseClasses.flatMap(familiesOf));
        if (baseFamilies.size === 0) continue;
        // The position comes from the match, not from a second `indexOf`. Re-finding
        // the tag reported the wrong line twice over: first for two identical tags (no
        // cursor), then — with a cursor — for a same-name NESTED tag, because the outer
        // tag's string spans past the inner one, so the cursor had already moved beyond
        // it and the lookup returned -1, reporting line 1. A scan's message is its
        // product, and this one was sending the reader to the wrong place (V2 round 4).
        for (const { tag, at } of openingTags(source, name)) {
          const tokens = classNameTokens(tag);
          inspected += tokens.length;
          for (const token of tokens) {
            const clashes = familiesOf(token).filter(
              (family) =>
                baseFamilies.has(family) &&
                !(OPT_OUT[name] ?? []).some(
                  (rule) => rule.family.test(family) && rule.when.test(tag),
                ),
            );
            if (clashes.length === 0) continue;
            // One message per token, not one per property it writes: `p-4` resolves to
            // four edges and four identical-looking lines are noise, not detail.
            const line = source.slice(0, at).split('\n').length;
            offenders.push(
              `${file.replace(process.cwd(), '')}:${line} <${name} className="… ${token} …"> fights its base ${clashes.join('/')}`,
            );
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
