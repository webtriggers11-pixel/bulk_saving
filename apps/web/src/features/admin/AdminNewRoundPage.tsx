import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { RoundTierDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { Select } from '../../components/ui/select';
import {
  OFFLINE_QUEUED_TEXT,
  OFFLINE_WAITING_LABEL,
  queryStalled,
} from '../../lib/offline';
import { unitLabelFor, unitLabelPluralFor } from '../../lib/units';
import { AdminLayout } from './AdminLayout';
import { errorMessage } from './adminFormat';
import { useAllServices, useAdminSocieties, useCreateRound } from './useAdmin';

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
  const services = useAllServices();
  const create = useCreateRound();

  const nextKey = useRef(1);
  // FEAT-022: "Open a round" from the dashboard demand list arrives with both chosen.
  const [searchParams] = useSearchParams();
  const [societyId, setSocietyId] = useState(() => searchParams.get('society') ?? '');
  const [serviceId, setServiceId] = useState(() => searchParams.get('service') ?? '');
  const [deadline, setDeadline] = useState('');
  const [tiers, setTiers] = useState<TierRow[]>([{ key: 0, threshold: '', price: '' }]);
  const [formError, setFormError] = useState<string | null>(null);

  const activeServices = (services.data ?? []).filter((service) => service.active);
  // FEAT-010: tier thresholds are counted in the SELECTED service's unit, so the form
  // says "threshold (rooms)" rather than "threshold (units)". Falls back to unit/units
  // before a service is chosen.
  const selectedService = activeServices.find((service) => service.id === serviceId);
  const selectedUnit = selectedService ? unitLabelFor(selectedService) : 'unit';
  const selectedUnitPlural = selectedService ? unitLabelPluralFor(selectedService) : 'units';

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
  // BUG-004: paused counts as failed for gating, or an offline admin sees an empty form.
  const loadFailed = queryStalled(societies) || queryStalled(services);

  return (
    <AdminLayout title="New round">
      <Card className="max-w-2xl">
        {loading && (
          <SkeletonScreen
            label="Loading societies and services…"
            testId="new-round-skeleton"
            className="flex flex-col gap-5"
          >
            {[0, 1, 2].map((row) => (
              <div key={row}>
                <Skeleton className="h-2.5 w-24" delay={(row % 4) as 0 | 1 | 2 | 3} />
                <Skeleton radius="control" className="mt-2 h-control w-full" delay={1} />
              </div>
            ))}
          </SkeletonScreen>
        )}
        {loadFailed && (
          <p role="alert" className="flex items-center gap-2 text-meta font-bold text-danger-ink">
            We couldn't load societies or services. Please try again.
          </p>
        )}
        {!loading && !loadFailed && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="New round" noValidate>
            <Field label="Society" id="round-society">
              {(props) => (
                <Select {...props} value={societyId} onChange={(e) => setSocietyId(e.target.value)}>
                  <option value="">Select a society</option>
                  {(societies.data ?? []).map((society) => (
                    <option key={society.id} value={society.id}>
                      {society.name} ({society.city})
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Service" id="round-service">
              {(props) => (
                <Select {...props} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  <option value="">Select a service</option>
                  {activeServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Deadline" id="round-deadline">
              {(props) => (
                <Input
                  {...props}
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              )}
            </Field>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-label uppercase text-ink-muted">
                Price tiers (price per {selectedUnit} once the {selectedUnit} threshold is
                reached)
              </legend>
              {tiers.map((row, index) => (
                <div key={row.key} className="flex items-end gap-2" data-testid="tier-row">
                  <Field
                    className="flex-1"
                    id={`tier-threshold-${row.key}`}
                    label={`Tier ${index + 1} threshold (${selectedUnitPlural})`}
                  >
                    {(props) => (
                      <Input
                        {...props}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={row.threshold}
                        onChange={(e) => updateTier(row.key, { threshold: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field
                    className="flex-1"
                    id={`tier-price-${row.key}`}
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
                        onChange={(e) => updateTier(row.key, { price: e.target.value })}
                      />
                    )}
                  </Field>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Remove tier ${index + 1}`}
                    disabled={tiers.length <= 1}
                    onClick={() => removeTier(row.key)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" className="self-start" onClick={addTier}>
                Add tier
              </Button>
            </fieldset>

            {formError && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink"
              >
                {formError}
              </p>
            )}
            {create.isError && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink"
              >
                {errorMessage(create.error)}
              </p>
            )}

            {create.isPaused && (
              <p
                role="status"
                data-testid="new-round-offline"
                className="flex items-center gap-2 rounded-chip border border-paper/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink"
              >
                {OFFLINE_QUEUED_TEXT}
              </p>
            )}
            <Button type="submit" disabled={create.isPending}>
              {create.isPaused ? OFFLINE_WAITING_LABEL : create.isPending ? 'Opening…' : 'Open round'}
            </Button>
          </form>
        )}
      </Card>
    </AdminLayout>
  );
}
