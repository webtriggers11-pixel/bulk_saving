import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';
import { EmptyState } from './empty-state';
import { Fact } from './fact';
import { Monogram, initialsOf } from './monogram';
import { StatCard } from './stat';
import { Field } from './field';
import { DataRow, DataRows, DataCell } from './data-rows';
import { Card } from './card';
import { Input } from './input';

/** Every app source file (no tests), for the structural assertions below. */
function sourcesUnderSrc(dir = join(process.cwd(), 'src'), out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourcesUnderSrc(path, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

describe('PageHeader', () => {
  it('renders one h1 and places the action opposite it', () => {
    render(<PageHeader title="Group buys" subtitle="Open rounds" action={<button>Back</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Group buys' })).toBeInTheDocument();
    expect(screen.getByText('Open rounds')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('omits the subtitle line entirely when there is none', () => {
    const { container } = render(<PageHeader title="Profile" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});

describe('EmptyState', () => {
  it('says what is missing and offers the way out when there is one', () => {
    render(
      <EmptyState
        icon="users"
        title="No open rounds yet"
        description="Check back soon."
        action={<a href="/rounds">See open rounds</a>}
        data-testid="rounds-empty"
      />,
    );
    expect(screen.getByTestId('rounds-empty')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No open rounds yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See open rounds' })).toBeInTheDocument();
  });

  it('is complete without an action — most empty states have nowhere to send you', () => {
    render(<EmptyState icon="clean" title="No services yet" description="Check back soon." />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Fact', () => {
  it.each(['tile', 'row', 'plain'] as const)(
    'keeps the testid on the value in the %s variant, where the screen contract expects it',
    (variant) => {
      render(
        <dl>
          <Fact term="Your pledge" value="2 rooms" variant={variant} testId="my-units" />
        </dl>,
      );
      expect(screen.getByTestId('my-units')).toHaveTextContent('2 rooms');
    },
  );

  it('takes markup as children when the value is not a string', () => {
    render(
      <dl>
        <Fact term="Tiers" variant="plain" testId="tiers">
          <ul>
            <li>5 rooms+: ₹3,500</li>
          </ul>
        </Fact>
      </dl>,
    );
    expect(screen.getByTestId('tiers')).toHaveTextContent('5 rooms+: ₹3,500');
  });

  it('keeps the testid on the value, where the screen contract expects it', () => {
    render(
      <dl>
        <Fact term="Your pledge" value="2 rooms" testId="my-units" />
        <Fact term="Price per room" value="₹3,500" variant="row" testId="my-price" />
      </dl>,
    );
    expect(screen.getByTestId('my-units')).toHaveTextContent('2 rooms');
    expect(screen.getByTestId('my-price')).toHaveTextContent('₹3,500');
  });
});

describe('Monogram', () => {
  it.each([
    ['Priya Sharma', 'PS'],
    ['Asha', 'A'],
    ['  ', '·'],
    [null, '·'],
  ])('derives %s -> %s in one place, so two screens cannot disagree', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });

  it('renders the initials it derived', () => {
    render(<Monogram name="Priya Sharma" data-testid="mono" />);
    expect(screen.getByTestId('mono')).toHaveTextContent('PS');
  });
});

describe('StatCard', () => {
  it('shows the value it was given and does not format it', () => {
    render(<StatCard label="Open rounds" value="₹1,20,000" icon="trend" note="this month" />);
    expect(screen.getByText('₹1,20,000')).toBeInTheDocument();
    expect(screen.getByText('this month')).toBeInTheDocument();
  });

  it('lifts the lead figure onto the accent surface', () => {
    const { container } = render(<StatCard label="Open" value="4" icon="clock" emphasis="lead" />);
    expect(container.firstElementChild?.className).toContain('surface-accent');
  });
});

describe('Field', () => {
  it('wires label, control and error together so a screen cannot get it wrong', () => {
    render(
      <Field label="Phone number" error="That number looks short.">
        {(props) => <Input {...props} defaultValue="+91" />}
      </Field>,
    );
    const input = screen.getByLabelText('Phone number');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('That number looks short.');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('marks nothing invalid when there is no error', () => {
    render(
      <Field label="Invite code" hint="(optional)">
        {(props) => <Input {...props} />}
      </Field>,
    );
    expect(screen.getByLabelText(/Invite code/)).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('DataRows', () => {
  it('is a list of rows, not a table — admin has no sorting or selection to promise', () => {
    render(
      <DataRows>
        <DataRow
          title="Painting"
          meta="Closes in 4 days"
          columns={<DataCell label="Units" value="18" />}
          trailing={<span>Open</span>}
          data-testid="round-row"
        />
      </DataRows>,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByTestId('round-row')).toHaveTextContent('Painting');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('AC2 — a shape is owned by one file', () => {
  const SRC = join(process.cwd(), 'src');

  function sourcesUnder(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) sourcesUnder(path, out);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
    }
    return out;
  }

  /** Each shape, the file that owns it, and the markup that gives it away. */
  const SHAPES: Array<[string, string, RegExp]> = [
    ['the page header', 'components/ui/page-header.tsx', /animate-rise flex items-start justify-between gap-3/],
    ['the empty state', 'components/ui/empty-state.tsx', /animate-breathe mx-auto flex h-\[58px\]/],
    ['the fact tile', 'components/ui/fact.tsx', /surface-inset min-w-0 flex-1 rounded-inset/],
    // The signature is the halo inside a round mark, not `paint-mono` alone: the
    // brand mark in the Home header legitimately paints with the same gradient.
    ['the monogram', 'components/ui/monogram.tsx', /animate-halo halo-sweep absolute -inset-1\/2/],
    ['the ambient ground', 'components/ui/ambient-ground.tsx', /animate-drift-a absolute/],
    ['the stat card', 'components/ui/stat.tsx', /num mt-1\.5 text-\[26px\]/],
    ['the row surface', 'components/ui/data-rows.tsx', /surface-solid card-hover t flex flex-col gap-3 rounded-tile p-4/],
    ['the row list', 'components/ui/data-rows.tsx', /stagger flex flex-col gap-2\.5/],
    ['the field error', 'components/ui/field.tsx', /mt-2 flex items-center gap-2 text-meta font-bold text-danger-ink/],
  ];

  it('the tiny uppercase label is a token, not a string four files retype', () => {
    const offenders = sourcesUnderSrc().filter((file) =>
      /text-\[10px\] font-extrabold uppercase tracking-\[0\.12em\] text-ink-soft/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(offenders.map((f) => f.replace(process.cwd(), ''))).toEqual([]);
  });

  it.each(SHAPES)('%s exists only in %s', (_shape, owner, markup) => {
    const offenders = sourcesUnder(SRC)
      .filter((file) => markup.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(`${SRC}/`, ''));
    expect(offenders).toEqual([owner]);
  });
});

describe('the dependency rule (ADR-0022)', () => {
  function sources(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) sources(path, out);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
    }
    return out;
  }

  // Both shared folders, not just components/: `lib/api.ts` was importing the auth
  // store while the first version of this test watched only `components/` (V2 P2-2).
  // Quotes of either kind, `import()` as well as `from`, and `../features` with or
  // without a trailing slash.
  const REACHES_INTO_FEATURES = /(?:from|import\s*\()\s*['"][^'"]*(?:\.\.\/)+features(?:\/|['"])/;

  it.each(['src/components', 'src/lib'])(
    '%s never imports from features — this is the rule that rots first',
    (folder) => {
      const offenders = sources(join(process.cwd(), folder)).filter((file) =>
        REACHES_INTO_FEATURES.test(readFileSync(file, 'utf8')),
      );
      expect(offenders.map((f) => f.replace(process.cwd(), ''))).toEqual([]);
    },
  );

  it('catches the shapes the first version missed', () => {
    for (const line of [
      "import { x } from '../features/auth/auth.store';",
      'import { x } from "../features/auth/auth.store";',
      "const m = await import('../../features/rounds/useRounds');",
      "export * from '../features';",
    ]) {
      expect(REACHES_INTO_FEATURES.test(line), line).toBe(true);
    }
    expect(REACHES_INTO_FEATURES.test("import { cn } from '../../lib/utils';")).toBe(false);
  });
});

describe('Card padding is a prop, not a className (V2 P1-1)', () => {
  it('applies the padding it is asked for, and nothing else', () => {
    const { container } = render(<Card padding="tight">x</Card>);
    const className = container.firstElementChild!.className;
    expect(className).toContain('p-4');
    // `cn` is a plain join: if the base padding were still emitted, both would land
    // and Tailwind's output order — not the caller — would decide which applies.
    expect(className).not.toContain('p-6');
  });

  it('emits no padding at all when the screen sizes its own card', () => {
    const { container } = render(<Card padding="none" className="p-[22px]">x</Card>);
    const className = container.firstElementChild!.className;
    expect(className).toContain('p-[22px]');
    expect(className).not.toMatch(/\bp-\d/);
  });

  it('never lets a caller class silently fight a primitive class', () => {
    // Every Card in the app either takes the prop or declares padding="none".
    const offenders: string[] = [];
    for (const file of sourcesUnderSrc()) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<Card\b[^>]*>/gs)) {
        const tag = match[0];
        if (/className="[^"]*\bp-(\[|\d)/.test(tag) && !/padding="none"/.test(tag)) {
          offenders.push(`${file.replace(process.cwd(), '')}: ${tag.slice(0, 60)}…`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
