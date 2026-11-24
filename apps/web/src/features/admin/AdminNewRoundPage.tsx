import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { parseTiers, TierFields, useTierRows } from './RoundTierFields';
import { errorMessage, timeAgo } from './adminFormat';
import { useAdminDashboard, useAllServices, useAdminSocieties, useCreateRound } from './useAdmin';
import { SOCIETY_PICKER_PAGE, SocietySelect } from './SocietySelect';

/**
 * Super-admin "open a round" form (FEAT-005): society, active service, deadline and
 * dynamic price tiers. On success it navigates to the new round's detail page; server
 * errors (e.g. ROUND_ALREADY_OPEN) are shown inline.
 */
export function AdminNewRoundPage() {
  const navigate = useNavigate();
  // Same key as the picker's first page, so it's one request (FEAT-044).
  const societies = useAdminSocieties({}, SOCIETY_PICKER_PAGE);
  const services = useAllServices();
  const create = useCreateRound();

  // FEAT-022: "Open a round" from the dashboard demand list arrives with both chosen.
  const [searchParams] = useSearchParams();
  const [societyId, setSocietyId] = useState(() => searchParams.get('society') ?? '');
  const [serviceId, setServiceId] = useState(() => searchParams.get('service') ?? '');
  const [deadline, setDeadline] = useState('');
  const { rows: tiers, update: updateTier, add: addTier, remove: removeTier } = useTierRows();
  const [formError, setFormError] = useState<string | null>(null);

  const activeServices = (services.data ?? []).filter((service) => service.active);
  // FEAT-010: tier thresholds are counted in the SELECTED service's unit, so the form
  // says "threshold (rooms)" rather than "threshold (units)". Falls back to unit/units
  // before a service is chosen.
  const selectedService = activeServices.find((service) => service.id === serviceId);
  // BUG-029: opened from a request, say who is asking — the dashboard query is usually cached.
  const fromAsk = searchParams.has('society') && searchParams.has('service');
  const dashboard = useAdminDashboard({ enabled: fromAsk });
  const ask = dashboard.data?.asks.find((a) => a.society.id === societyId && a.service.id === serviceId);
  const selectedUnit = selectedService ? unitLabelFor(selectedService) : 'unit';
  const selectedUnitPlural = selectedService ? unitLabelPluralFor(selectedService) : 'units';

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
            {ask && (
              <p className="rounded-chip border border-paper/55 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-ink" data-testid="ask-context">
                {ask.askCount === 1 ? '1 resident' : `${ask.askCount} residents`} of {ask.society.name} asked for {ask.service.name} (latest {timeAgo(ask.latest)}).
                Everyone who asked is told when you open it.
              </p>
            )}
            <Field label="Society" id="round-society">
              {(props) => (
                <SocietySelect {...props} value={societyId} onChange={setSocietyId} emptyLabel="Select a society" />
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

            <TierFields
              rows={tiers}
              unit={selectedUnit}
              unitPlural={selectedUnitPlural}
              onChange={updateTier}
              onAdd={addTier}
              onRemove={removeTier}
            />

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
