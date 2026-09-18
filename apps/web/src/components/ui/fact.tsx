import { cn } from '../../lib/utils';

interface FactTileProps {
  /** The label, e.g. "Your pledge". Rendered uppercase; pass it in sentence case. */
  term: string;
  value: string;
  /** Kept as a prop because the id belongs to the screen's contract, not to this tile. */
  testId?: string;
  className?: string;
}

/**
 * One labelled fact, as a tile (CHORE-008, ADR-0022). Used in pairs on My Requests,
 * in twos and threes on Profile and on the admin round detail.
 *
 * Deliberately NOT a <dl>: a tile is a cell, and whether a group of them is a
 * description list is the caller's question. `FactRow` below is the list version.
 */
export function FactTile({ term, value, testId, className }: FactTileProps) {
  return (
    <div className={cn('surface-inset min-w-0 flex-1 rounded-inset px-3.5 py-3', className)}>
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">{term}</dt>
      <dd className="num mt-1.5 text-[15.5px] font-extrabold text-ink" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

/** The same fact as a row, for the denser lists the admin detail screen needs. */
export function FactRow({ term, value, testId, className }: FactTileProps) {
  return (
    <div
      className={cn(
        'row-hover t -mx-2.5 flex items-center justify-between gap-3 rounded-chip border-t border-shade/10 px-2.5 py-3',
        className,
      )}
    >
      <dt className="text-caption font-semibold text-ink-muted">{term}</dt>
      <dd className="num text-body font-extrabold text-ink" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
