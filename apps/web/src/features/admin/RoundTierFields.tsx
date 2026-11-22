import { useRef, useState } from 'react';
import type { RoundTierDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';

/** One editable tier row; `key` is a stable React key, values are raw input strings. */
export interface TierRow {
  key: number;
  threshold: string;
  price: string;
}

/** Parse a raw input as a positive integer, or null. */
function positiveInt(raw: string): number | null {
  if (raw.trim() === '') {
    return null;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Validate the tier rows: at least one, every threshold and price a positive
 * integer, thresholds strictly ascending. Returns the parsed tiers or an error.
 */
export function parseTiers(rows: TierRow[]): { tiers: RoundTierDto[] } | { error: string } {
  if (rows.length === 0) {
    return { error: 'Add at least one tier.' };
  }
  const tiers: RoundTierDto[] = [];
  for (const [index, row] of rows.entries()) {
    const threshold = positiveInt(row.threshold);
    const price = positiveInt(row.price);
    if (threshold === null || price === null) {
      return { error: `Tier ${index + 1}: threshold and price must be whole numbers above 0.` };
    }
    const previous = tiers[tiers.length - 1];
    if (previous && threshold <= previous.threshold) {
      return { error: 'Tier thresholds must be strictly ascending.' };
    }
    tiers.push({ threshold, price });
  }
  return { tiers };
}


/** Tier rows from saved tiers (Edit round), or one empty row (New round). */
export function toTierRows(tiers: RoundTierDto[] = []): TierRow[] {
  return tiers.length > 0
    ? tiers.map((t, key) => ({ key, threshold: String(t.threshold), price: String(t.price) }))
    : [{ key: 0, threshold: '', price: '' }];
}

/** State for an editable list of tier rows, with stable keys. */
export function useTierRows(initial: RoundTierDto[] = []) {
  const [rows, setRows] = useState<TierRow[]>(() => toTierRows(initial));
  const nextKey = useRef(rows.length);
  return {
    rows,
    reset: (tiers: RoundTierDto[]) => {
      const next = toTierRows(tiers);
      nextKey.current = next.length;
      setRows(next);
    },
    update: (key: number, patch: Partial<Omit<TierRow, 'key'>>) =>
      setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row))),
    add: () => {
      const key = nextKey.current;
      nextKey.current += 1;
      setRows((current) => [...current, { key, threshold: '', price: '' }]);
    },
    remove: (key: number) => setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current)),
  };
}

/** The price-tier inputs shared by New round and Edit round (FEAT-038). */
export function TierFields({
  rows,
  unit,
  unitPlural,
  idPrefix = 'tier',
  onChange,
  onAdd,
  onRemove,
}: {
  rows: TierRow[];
  unit: string;
  unitPlural: string;
  idPrefix?: string;
  onChange: (key: number, patch: Partial<Omit<TierRow, 'key'>>) => void;
  onAdd: () => void;
  onRemove: (key: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-label uppercase text-ink-muted">
        Price tiers (price per {unit} once the {unit} threshold is
        reached)
      </legend>
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-end gap-2" data-testid="tier-row">
          <Field
            className="flex-1"
            id={`${idPrefix}-threshold-${row.key}`}
            label={`Tier ${index + 1} threshold (${unitPlural})`}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={row.threshold}
                onChange={(e) => onChange(row.key, { threshold: e.target.value })}
              />
            )}
          </Field>
          <Field
            className="flex-1"
            id={`${idPrefix}-price-${row.key}`}
            label={`Tier ${index + 1} price (₹)`}
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={row.price}
                onChange={(e) => onChange(row.key, { price: e.target.value })}
              />
            )}
          </Field>
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Remove tier ${index + 1}`}
            disabled={rows.length <= 1}
            onClick={() => onRemove(row.key)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" className="self-start" onClick={onAdd}>
        Add tier
      </Button>
    </fieldset>
  );
}
