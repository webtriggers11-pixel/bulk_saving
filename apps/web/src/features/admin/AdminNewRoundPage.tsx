import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoundTierDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { AdminLayout } from './AdminLayout';
import { errorMessage } from './adminFormat';
import { useAdminServices, useAdminSocieties, useCreateRound } from './useAdmin';

/** One editable tier row; `key` is a stable React key, values are raw input strings. */
interface TierRow {
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
function parseTiers(rows: TierRow[]): { tiers: RoundTierDto[] } | { error: string } {
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

/**
 * Super-admin "open a round" form (FEAT-005): society, active service, deadline and
 * dynamic price tiers. On success it navigates to the new round's detail page; server
 * errors (e.g. ROUND_ALREADY_OPEN) are shown inline.
 */
export function AdminNewRoundPage() {
  const navigate = useNavigate();
  const societies = useAdminSocieties();
  const services = useAdminServices();
  const create = useCreateRound();

  const nextKey = useRef(1);
  const [societyId, setSocietyId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tiers, setTiers] = useState<TierRow[]>([{ key: 0, threshold: '', price: '' }]);
  const [formError, setFormError] = useState<string | null>(null);

  const activeServices = (services.data ?? []).filter((service) => service.active);

  function updateTier(key: number, patch: Partial<Omit<TierRow, 'key'>>) {
    setTiers((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addTier() {
    const key = nextKey.current;
    nextKey.current += 1;
    setTiers((rows) => [...rows, { key, threshold: '', price: '' }]);
  }

  function removeTier(key: number) {
    setTiers((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!societyId || !serviceId) {
      setFormError('Choose a society and a service.');
      return;
    }
    const deadlineDate = new Date(deadline);
    if (deadline === '' || Number.isNaN(deadlineDate.getTime())) {
      setFormError('Choose a deadline.');
      return;
    }
    const parsed = parseTiers(tiers);
    if ('error' in parsed) {
      setFormError(parsed.error);
      return;
    }
    setFormError(null);
    create.mutate(
      { societyId, serviceId, deadline: deadlineDate.toISOString(), tiers: parsed.tiers },
      { onSuccess: (round) => navigate(`/admin/rounds/${round.id}`) },
    );
  }

  const loading = societies.isLoading || services.isLoading;
  const loadFailed = societies.isError || services.isError;

  return (
    <AdminLayout title="New round">
      <Card className="max-w-2xl">
        {loading && <p className="text-slate-500">Loading societies and services…</p>}
        {loadFailed && (
          <p role="alert" className="text-red-600">
            We couldn't load societies or services. Please try again.
          </p>
        )}
        {!loading && !loadFailed && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="New round" noValidate>
            <div>
              <Label htmlFor="round-society">Society</Label>
              <Select id="round-society" value={societyId} onChange={(e) => setSocietyId(e.target.value)}>
                <option value="">Select a society</option>
                {(societies.data ?? []).map((society) => (
                  <option key={society.id} value={society.id}>
                    {society.name} ({society.city})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="round-service">Service</Label>
              <Select id="round-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">Select a service</option>
                {activeServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="round-deadline">Deadline</Label>
              <Input
                id="round-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1.5 text-sm font-medium text-slate-700">
                Price tiers (price per unit once the unit threshold is reached)
              </legend>
              {tiers.map((row, index) => (
                <div key={row.key} className="flex items-end gap-2" data-testid="tier-row">
                  <div className="flex-1">
                    <Label htmlFor={`tier-threshold-${row.key}`}>Tier {index + 1} threshold (units)</Label>
                    <Input
                      id={`tier-threshold-${row.key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={row.threshold}
                      onChange={(e) => updateTier(row.key, { threshold: e.target.value })}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={`tier-price-${row.key}`}>Tier {index + 1} price (₹)</Label>
                    <Input
                      id={`tier-price-${row.key}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step={1}
                      value={row.price}
                      onChange={(e) => updateTier(row.key, { price: e.target.value })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    className="border border-slate-300"
                    aria-label={`Remove tier ${index + 1}`}
                    disabled={tiers.length <= 1}
                    onClick={() => removeTier(row.key)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="ghost" className="self-start border border-slate-300" onClick={addTier}>
                Add tier
              </Button>
            </fieldset>

            {formError && (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            )}
            {create.isError && (
              <p role="alert" className="text-sm text-red-600">
                {errorMessage(create.error)}
              </p>
            )}

            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Opening…' : 'Open round'}
            </Button>
          </form>
        )}
      </Card>
    </AdminLayout>
  );
}
