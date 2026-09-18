import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './page-header';
import { EmptyState } from './empty-state';
import { FactTile, FactRow } from './fact';
import { Monogram, initialsOf } from './monogram';
import { StatCard } from './stat';
import { Field } from './field';
import { DataRow, DataRows, DataCell } from './data-rows';
import { Input } from './input';

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

describe('FactTile / FactRow', () => {
  it('keeps the testid on the value, where the screen contract expects it', () => {
    render(
      <dl>
        <FactTile term="Your pledge" value="2 rooms" testId="my-units" />
        <FactRow term="Price per room" value="₹3,500" testId="my-price" />
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

describe('the dependency rule (ADR-0022)', () => {
  const UI = join(process.cwd(), 'src/components');

  function sources(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) sources(path, out);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
    }
    return out;
  }

  it('components/ui never imports from features — this is the rule that rots first', () => {
    const offenders = sources(UI).filter((file) =>
      /from\s+'[^']*features\//.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((f) => f.replace(process.cwd(), ''))).toEqual([]);
  });
});
