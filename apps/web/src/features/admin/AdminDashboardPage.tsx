import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminRoundsQuery, RoundStatus } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { cn } from '../../lib/utils';
import { AdminLayout } from './AdminLayout';
import { STATUS_LABELS, STATUS_ORDER, formatDateTime, formatRupees } from './adminFormat';
import { StatusBadge } from './StatusBadge';
import { useAdminDashboard, useAdminRounds, useAdminSocieties } from './useAdmin';
import { queryStalled } from '../../lib/offline';

/** Statuses where the admin has work to do; their tiles are highlighted. */
const ACTION_STATUSES: RoundStatus[] = ['CLOSED_MET', 'ASSIGNED'];

/** Narrow a select value to a RoundStatus ('' means "All"). */
function toStatus(value: string): RoundStatus | undefined {
  return STATUS_ORDER.find((status) => status === value);
}

/** Status tiles, demand by society and payment totals from GET /admin/dashboard. */
function DashboardSummary() {
  const dashboard = useAdminDashboard();
  const { data, isLoading, refetch } = dashboard;
  // BUG-004: offline pauses rather than errors, so gate on both.
  const isError = queryStalled(dashboard);

  if (isLoading) {
    return <p className="text-slate-500">Loading dashboard…</p>;
  }
  if (isError || !data) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-red-600">We couldn't load the dashboard. Please try again.</p>
        <Button onClick={() => void refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <>
      <section aria-label="Rounds by status" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {STATUS_ORDER.map((status) => {
          const highlight = ACTION_STATUSES.includes(status);
          return (
            <div
              key={status}
              data-testid={`status-tile-${status}`}
              className={cn(
                'rounded-xl border p-4 shadow-sm',
                highlight && data.statusCounts[status] > 0
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-slate-200 bg-white',
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {STATUS_LABELS[status]}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{data.statusCounts[status]}</p>
            </div>
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
            <p className="text-sm text-slate-500">No societies yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Society</th>
                    <th className="py-2 pr-3 text-right">Open rounds</th>
                    <th className="py-2 pr-3 text-right">Units (mixed)</th>
                    <th className="py-2 text-right">Residents joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.demandBySociety.map((row) => (
                    <tr key={row.society.id}>
                      <td className="py-2 pr-3">
                        <span className="font-medium text-slate-900">{row.society.name}</span>
                        <span className="block text-xs text-slate-500">{row.society.city}</span>
                      </td>
                      <td className="py-2 pr-3 text-right">{row.openRounds}</td>
                      <td className="py-2 pr-3 text-right">{row.unitsPledged}</td>
                      <td className="py-2 text-right">{row.residentsJoined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>Assigned, delivered and rated rounds</CardDescription>
          </CardHeader>
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="text-sm text-slate-500">Collected</dt>
              <dd className="text-2xl font-bold text-teal-700" data-testid="payments-collected">
                {formatRupees(data.payments.collectedAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Outstanding</dt>
              <dd className="text-2xl font-bold text-slate-900" data-testid="payments-outstanding">
                {formatRupees(data.payments.outstandingAmount)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}

/** Rounds across societies with status + society filters; rows link to the detail page. */
function RoundsTable() {
  const [filters, setFilters] = useState<AdminRoundsQuery>({});
  const societies = useAdminSocieties();
  const roundsQuery = useAdminRounds(filters);
  const { data, isLoading, refetch } = roundsQuery;
  const isError = queryStalled(roundsQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rounds</CardTitle>
      </CardHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="filter-status">Status</Label>
          <Select
            id="filter-status"
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: toStatus(e.target.value) }))}
          >
            <option value="">All statuses</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-society">Society</Label>
          <Select
            id="filter-society"
            value={filters.societyId ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, societyId: e.target.value || undefined }))
            }
          >
            <option value="">All societies</option>
            {(societies.data ?? []).map((society) => (
              <option key={society.id} value={society.id}>
                {society.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <p className="text-slate-500">Loading rounds…</p>}
      {isError && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-red-600">We couldn't load the rounds. Please try again.</p>
          <Button onClick={() => void refetch()}>Retry</Button>
        </div>
      )}
      {data && data.length === 0 && (
        <p className="text-sm text-slate-500" data-testid="admin-rounds-empty">
          No rounds match these filters.
        </p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Service</th>
                <th className="py-2 pr-3">Society</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Units / residents</th>
                <th className="py-2 pr-3 text-right">Price</th>
                <th className="py-2">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((round) => (
                <tr key={round.id} data-testid="admin-round-row">
                  <td className="py-2 pr-3">
                    <Link
                      to={`/admin/rounds/${round.id}`}
                      className="font-medium text-teal-700 underline-offset-4 hover:underline"
                    >
                      {round.service.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{round.society.name}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={round.status} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {round.unitsCount} / {round.participantsCount}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {formatRupees(round.finalPrice ?? round.currentPrice)}
                    {round.finalPrice !== null && (
                      <span className="block text-xs text-slate-500">final</span>
                    )}
                  </td>
                  <td className="py-2 whitespace-nowrap">{formatDateTime(round.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * Super-admin dashboard (FEAT-005): where to act at a glance. Status tiles (the
 * "Needs vendor" and "Awaiting delivery" tiles are highlighted), demand pledged per
 * society, payment totals, and the filterable rounds table.
 */
export function AdminDashboardPage() {
  return (
    <AdminLayout title="Dashboard">
      <DashboardSummary />
      <RoundsTable />
    </AdminLayout>
  );
}
