import { Link } from 'react-router-dom';
import type { AdminRoundsQuery, RoundStatus } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { DataCell, DataRow, DataRows } from '../../components/ui/data-rows';
import { EmptyState } from '../../components/ui/empty-state';
import { FilterChips } from '../../components/ui/filter-chips';
import { ResultSummary } from '../../components/ui/result-summary';
import { SearchField } from '../../components/ui/search-field';
import { Field } from '../../components/ui/field';
import { Icon } from '../../components/ui/icon';
import { Select } from '../../components/ui/select';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { StatCard } from '../../components/ui/stat';
import { AdminLayout } from './AdminLayout';
import { STATUS_LABELS, STATUS_ORDER, formatDateTime, formatRupees } from './adminFormat';
import { StatusBadge } from './StatusBadge';
import { useAdminDashboard, useAdminRounds, useAdminSocieties } from './useAdmin';
import { useDebouncedSearch, useUrlFilters } from '../../lib/filters';
import { queryStalled } from '../../lib/offline';
import { CATEGORY_FILTER_OPTIONS, isListedCategory } from '../../lib/categories';
import { formatUnits } from '../../lib/units';

/** Statuses where the admin has work to do; their tiles are highlighted. */
const ACTION_STATUSES: RoundStatus[] = ['CLOSED_MET', 'ASSIGNED'];

/** Narrow a select value to a RoundStatus ('' means "All"). */
function toStatus(value: string): RoundStatus | undefined {
  return STATUS_ORDER.find((status) => status === value);
}

/** The one failure message both panels show, with the retry that goes with it. */
function PanelError({ subject, onRetry }: { subject: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="animate-rise flex flex-col items-start gap-3 rounded-inset border border-paper/55 bg-danger-ink/10 px-4 py-4 text-danger-ink shadow-hairline"
    >
      <p className="flex gap-2.5 text-meta font-bold">
        <Icon name="alert" size={18} strokeWidth={2} />
        We couldn&apos;t load the {subject}. Please try again.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <Icon name="refresh" size={16} strokeWidth={2.1} />
        Retry
      </Button>
    </div>
  );
}

/** Status tiles, demand by society and payment totals from GET /admin/dashboard. */
function DashboardSummary() {
  const dashboard = useAdminDashboard();
  const { data, isLoading, refetch } = dashboard;
  // BUG-004: offline pauses rather than errors, so gate on both.
  const isError = queryStalled(dashboard);

  if (isLoading) {
    return (
      <SkeletonScreen label="Loading dashboard…" testId="dashboard-skeleton" className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {STATUS_ORDER.map((status, index) => (
            <div key={status} className="surface-solid rounded-tile p-4">
              <Skeleton className="h-2.5 w-3/4" delay={(index % 4) as 0 | 1 | 2 | 3} />
              <Skeleton className="mt-3 h-6 w-1/3" delay={2} />
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="surface-glass rounded-card p-6 md:col-span-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-3 w-2/3" delay={1} />
            <Skeleton radius="inset" className="mt-5 h-24 w-full" delay={2} />
          </div>
          <div className="surface-glass rounded-card p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-5 h-8 w-32" delay={1} />
            <Skeleton className="mt-4 h-8 w-32" delay={2} />
          </div>
        </div>
      </SkeletonScreen>
    );
  }
  if (isError || !data) {
    return <PanelError subject="dashboard" onRetry={() => void refetch()} />;
  }

  return (
    <>
      {/* The lifecycle at a glance. A status the admin must ACT on lights up only when
          it actually holds rounds — a highlighted zero is noise, and noise is how a
          dashboard stops being read. */}
      <section
        aria-label="Rounds by status"
        className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
      >
        {STATUS_ORDER.map((status) => {
          const count = data.statusCounts[status];
          const needsAction = ACTION_STATUSES.includes(status) && count > 0;
          return (
            <StatCard
              key={status}
              label={STATUS_LABELS[status]}
              value={String(count)}
              emphasis={needsAction ? 'alert' : 'quiet'}
              density="dense"
              data-testid={`status-tile-${status}`}
            />
          );
        })}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Demand by society</CardTitle>
            {/* FEAT-010: this figure sums units ACROSS services, so there is no single
                unit to name — 3 rooms of painting and 2 ACs are 5 here. Said explicitly
                rather than labelled with one service's word, which would be wrong. */}
            <CardDescription>
              Units pledged in open rounds — mixed services, so counts are not comparable
            </CardDescription>
          </CardHeader>
          {data.demandBySociety.length === 0 ? (
            <p className="text-caption text-ink-muted">No societies yet.</p>
          ) : (
            <DataRows>
              {data.demandBySociety.map((row) => (
                <DataRow
                  key={row.society.id}
                  title={row.society.name}
                  meta={row.society.city}
                  columns={
                    <>
                      <DataCell label="Open rounds" value={row.openRounds} />
                      <DataCell label="Units (mixed)" value={row.unitsPledged} />
                      <DataCell label="Residents joined" value={row.residentsJoined} />
                    </>
                  }
                />
              ))}
            </DataRows>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <StatCard
            label="Collected"
            value={formatRupees(data.payments.collectedAmount)}
            icon="check"
            note="Assigned, delivered and rated rounds"
            emphasis="lead"
            data-testid="payments-collected"
          />
          <StatCard
            label="Outstanding"
            value={formatRupees(data.payments.outstandingAmount)}
            icon="clock"
            data-testid="payments-outstanding"
          />
        </div>
      </div>
    </>
  );
}

const ROUND_FILTER_KEYS = ['status', 'societyId', 'q', 'category'] as const;
const ROUND_FILTER_VALID = {
  category: isListedCategory,
  status: (value: string) => toStatus(value) !== undefined,
};

/**
 * Rounds across societies, filtered on the server by status, society, category and a
 * search over service, society and vendor name (FEAT-015). The filters live in the URL,
 * so a refresh — or a link sent to a colleague — opens the same list.
 */
function RoundsPanel() {
  const { filters: raw, setFilters, clear, activeCount, generation } = useUrlFilters(ROUND_FILTER_KEYS, ROUND_FILTER_VALID);
  const [search, setSearch] = useDebouncedSearch(raw.q, (q) => setFilters({ q }), generation);
  const filters: AdminRoundsQuery = {
    status: toStatus(raw.status ?? ''),
    societyId: raw.societyId,
    q: raw.q,
    category: raw.category,
  };
  const societies = useAdminSocieties();
  const roundsQuery = useAdminRounds(filters);
  const { data, isLoading, isPlaceholderData, refetch } = roundsQuery;
  const isError = queryStalled(roundsQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rounds</CardTitle>
      </CardHeader>

      <div className="mb-3 flex flex-col gap-3" role="search" aria-label="Filter rounds">
        <SearchField
          label="Search rounds"
          placeholder="Search by service, society or vendor"
          value={search}
          onChange={setSearch}
          maxLength={80}
        />
        <FilterChips
          label="Category"
          options={CATEGORY_FILTER_OPTIONS}
          value={raw.category ?? ''}
          onChange={(category) => setFilters({ category: category || undefined })}
        />
      </div>
      <div className="mb-2 grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          {(props) => (
            <Select
              {...props}
              value={filters.status ?? ''}
              onChange={(e) => setFilters({ status: toStatus(e.target.value) })}
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Society">
          {(props) => (
            <Select
              {...props}
              value={filters.societyId ?? ''}
              onChange={(e) => setFilters({ societyId: e.target.value || undefined })}
            >
              <option value="">All societies</option>
              {(societies.data ?? []).map((society) => (
                <option key={society.id} value={society.id}>
                  {society.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <ResultSummary
        className="mb-3"
        count={data?.length}
        noun={['round', 'rounds']}
        activeCount={activeCount}
        onClear={clear}
        busy={isPlaceholderData}
      />

      {isLoading && (
        <SkeletonScreen label="Loading rounds…" testId="admin-rounds-skeleton" className="flex flex-col gap-2.5">
          {[0, 1, 2].map((row) => (
            <div key={row} className="surface-solid flex items-center gap-5 rounded-tile p-4">
              <Skeleton className="h-4 w-1/4" delay={(row % 4) as 0 | 1 | 2 | 3} />
              <Skeleton radius="full" className="ml-auto h-6 w-24" delay={1} />
              <Skeleton className="h-4 w-20" delay={2} />
              <Skeleton className="h-4 w-24" delay={3} />
            </div>
          ))}
        </SkeletonScreen>
      )}
      {isError && <PanelError subject="rounds" onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          icon="info"
          title={activeCount > 0 ? 'No rounds match these filters' : 'No rounds yet'}
          description={activeCount > 0 ? 'Loosen a filter, or clear them all.' : 'Open a round for a society to start pooling demand.'}
          data-testid="admin-rounds-empty"
          action={
            activeCount > 0 ? (
              <Button variant="secondary" onClick={clear}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}
      {data && data.length > 0 && (
        <div className="results" aria-busy={isPlaceholderData}>
        <DataRows>
          {data.map((round) => (
            <DataRow
              key={round.id}
              className="row-in"
              data-testid="admin-round-row"
              title={
                <Link
                  to={`/admin/rounds/${round.id}`}
                  className="t rounded-chip text-brand-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:shadow-focus"
                >
                  {round.service.name}
                </Link>
              }
              meta={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {round.society.name}
                  <span aria-hidden="true" className="text-ink-soft">
                    ·
                  </span>
                  <span className="num">{formatDateTime(round.deadline)}</span>
                </span>
              }
              columns={
                <>
                  <DataCell
                    label="Units / residents"
                    value={
                      /* Per-round, so the service IS known — unlike the mixed-service
                         demand total above (V2 P2). */
                      `${formatUnits(round.unitsCount, round.service)} / ${round.participantsCount}`
                    }
                  />
                  <DataCell
                    label={round.finalPrice !== null ? 'Final price' : 'Price'}
                    value={formatRupees(round.finalPrice ?? round.currentPrice)}
                  />
                </>
              }
              trailing={<StatusBadge status={round.status} />}
            />
          ))}
        </DataRows>
        </div>
      )}
    </Card>
  );
}

/**
 * Super-admin dashboard (FEAT-005): where to act at a glance. Status tiles (the
 * "Needs vendor" and "Awaiting delivery" tiles are highlighted), demand pledged per
 * society, payment totals, and the filterable rounds list.
 */
export function AdminDashboardPage() {
  return (
    <AdminLayout title="Dashboard" subtitle="Demand, money and what needs a vendor">
      <DashboardSummary />
      <RoundsPanel />
    </AdminLayout>
  );
}
