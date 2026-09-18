import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * A dense list of records (CHORE-008, ADR-0022) — the admin's rounds, vendors and
 * participants.
 *
 * Deliberately NOT a table: admin has no sorting, no paging and no selection, and a
 * table primitive that pretends otherwise is a promise the screens do not keep. It
 * is a list of rows that lays out as columns from `md` up and stacks below it, so the
 * same markup reads on a phone — which is where the owner actually approves things.
 */
export function DataRows({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('stagger flex flex-col gap-2.5', className)}>{children}</ul>;
}

interface DataRowProps {
  /** The main identifier of the record. */
  title: ReactNode;
  /** One line under it: what this record is, or where it stands. */
  meta?: ReactNode;
  /** Right-aligned facts, laid out in a row from md up. */
  columns?: ReactNode;
  /** Status pill, buttons — pinned to the end. */
  trailing?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function DataRow({ title, meta, columns, trailing, className, 'data-testid': testId }: DataRowProps) {
  return (
    <li>
      <div
        className={cn(
          'surface-solid card-hover t flex flex-col gap-3 rounded-tile p-4 md:flex-row md:items-center md:gap-5',
          className,
        )}
        data-testid={testId}
      >
        <div className="min-w-0 flex-1">
          <div className="text-body font-extrabold tracking-[-0.02em] text-ink">{title}</div>
          {meta && <div className="mt-1 text-meta text-ink-muted">{meta}</div>}
        </div>
        {columns && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 md:justify-end">{columns}</div>
        )}
        {trailing && <div className="flex items-center gap-2 md:ml-2">{trailing}</div>}
      </div>
    </li>
  );
}

/** One right-hand fact inside a row: a small label over a tabular value. */
export function DataCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">{label}</div>
      <div className="num mt-0.5 text-body font-extrabold text-ink">{value}</div>
    </div>
  );
}
