import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useIsMutating } from '@tanstack/react-query';
import type { AdminRoundDetailDto, RoundStatus } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { ApiError } from '../../lib/api';
import { AdminLayout } from './AdminLayout';
import { errorMessage, formatDateTime, formatRupees } from './adminFormat';
import { formatRatingSummary } from '../rating/formatRating';
import { StatusBadge } from './StatusBadge';
import {
  adminKeys,
  useAdminRound,
  useAssignRound,
  useCancelRound,
  useCloseRound,
  useDeliverRound,
  useSetPayment,
  useVendors,
} from './useAdmin';

/** Final price bounds (integer ₹ per unit), mirroring the backend AssignRoundBody validation. */
const MIN_FINAL_PRICE = 1;
const MAX_FINAL_PRICE = 1_000_000;

/** Statuses from which the admin may cancel (anything before DELIVERED that isn't terminal). */
const CANCELLABLE: RoundStatus[] = ['OPEN', 'CLOSED_MET', 'CLOSED_EXPIRED', 'ASSIGNED'];

/** Statuses where a vendor is assigned, so payments can be collected. */
const PAYABLE: RoundStatus[] = ['ASSIGNED', 'DELIVERED', 'RATED'];

/** A labelled value in the round summary grid. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{children}</dd>
    </div>
  );
}

/** Round header: service, society, status, deadline, units, tiers, prices, vendor, delivery. */
function RoundSummary({ round }: { round: AdminRoundDetailDto }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            {round.service.category}
          </span>
          <h2 className="text-xl font-bold text-slate-900">{round.service.name}</h2>
          <p className="text-sm text-slate-500">
            {round.society.name}, {round.society.city}
          </p>
        </div>
        <StatusBadge status={round.status} />
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Fact label="Deadline">{formatDateTime(round.deadline)}</Fact>
        <Fact label="Units / residents">
          {round.unitsCount} / {round.participantsCount}
        </Fact>
        <Fact label="Current price">{formatRupees(round.currentPrice)}</Fact>
        <Fact label="Rating">
          <span data-testid="round-rating">{formatRatingSummary(round.ratings)}</span>
        </Fact>
        <Fact label="Tiers">
          <ul>
            {round.tiers.map((tier) => (
              <li key={tier.threshold}>
                {tier.threshold}+ units: {formatRupees(tier.price)}
              </li>
            ))}
          </ul>
        </Fact>
        {round.vendor && (
          <Fact label="Vendor">
            {round.vendor.name}
            <span className="block text-xs text-slate-500">{round.vendor.phone}</span>
          </Fact>
        )}
        {round.finalPrice !== null && (
          <Fact label="Final price">
            <span data-testid="final-price">{formatRupees(round.finalPrice)}</span>
          </Fact>
        )}
        {round.assignedAt && <Fact label="Assigned">{formatDateTime(round.assignedAt)}</Fact>}
        {round.deliveredAt && <Fact label="Delivered">{formatDateTime(round.deliveredAt)}</Fact>}
      </dl>
    </Card>
  );
}

/** Vendor + final price form for a CLOSED_MET round. Submit stays disabled until valid. */
function AssignForm({ roundId, busy }: { roundId: string; busy: boolean }) {
  const vendors = useVendors();
  const assign = useAssignRound(roundId);
  const [vendorId, setVendorId] = useState('');
  const [finalPrice, setFinalPrice] = useState('');

  const activeVendors = (vendors.data ?? []).filter((vendor) => vendor.active);
  const price = Number(finalPrice);
  const priceValid =
    finalPrice.trim() !== '' &&
    Number.isInteger(price) &&
    price >= MIN_FINAL_PRICE &&
    price <= MAX_FINAL_PRICE;
  const valid = vendorId !== '' && priceValid;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) {
      return;
    }
    assign.mutate({ vendorId, finalPrice: price });
  }

  if (vendors.isLoading) {
    return <p className="text-slate-500">Loading vendors…</p>;
  }
  if (vendors.isError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        We couldn't load vendors. Please try again.
      </p>
    );
  }
  if (activeVendors.length === 0) {
    return (
      <p className="text-sm text-slate-600" data-testid="no-active-vendors">
        No active vendors.{' '}
        <Link to="/admin/vendors" className="font-semibold text-teal-700 hover:underline">
          Add a vendor
        </Link>{' '}
        to assign this round.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-label="Assign vendor">
      <div>
        <Label htmlFor="assign-vendor">Vendor</Label>
        <Select id="assign-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          <option value="">Select a vendor</option>
          {activeVendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
              {vendor.category ? ` (${vendor.category})` : ''}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="assign-price">Final price per unit (₹)</Label>
        <Input
          id="assign-price"
          type="number"
          inputMode="numeric"
          min={MIN_FINAL_PRICE}
          max={MAX_FINAL_PRICE}
          step={1}
          value={finalPrice}
          onChange={(e) => setFinalPrice(e.target.value)}
          aria-invalid={finalPrice !== '' && !priceValid}
        />
        {finalPrice !== '' && !priceValid && (
          <p className="mt-1 text-sm text-red-600">Enter a whole number from 1 to 10,00,000.</p>
        )}
      </div>
      <Button type="submit" disabled={!valid || busy || assign.isPending}>
        {assign.isPending ? 'Assigning…' : 'Assign vendor'}
      </Button>
      {assign.isError && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage(assign.error)}
        </p>
      )}
    </form>
  );
}

/**
 * Status-driven actions: Close (OPEN), Assign (CLOSED_MET), Deliver (ASSIGNED) and
 * Cancel with an inline two-step confirm (any pre-DELIVERED, non-terminal status).
 */
function RoundActions({ round }: { round: AdminRoundDetailDto }) {
  const close = useCloseRound(round.id);
  const deliver = useDeliverRound(round.id);
  const cancel = useCancelRound(round.id);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // The assign mutation lives in AssignForm; watch it by key so Cancel can't race it.
  const assigning = useIsMutating({ mutationKey: adminKeys.assignMutation(round.id) }) > 0;
  const busy = close.isPending || deliver.isPending || cancel.isPending || assigning;
  // Every status with a forward action (OPEN, CLOSED_MET, ASSIGNED) is also cancellable.
  const canCancel = CANCELLABLE.includes(round.status);

  if (!canCancel) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-4">
        {round.status === 'OPEN' && (
          <Button disabled={busy} onClick={() => close.mutate()}>
            {close.isPending ? 'Closing…' : 'Close round'}
          </Button>
        )}

        {round.status === 'CLOSED_MET' && <AssignForm roundId={round.id} busy={busy} />}

        {round.status === 'ASSIGNED' && (
          <Button disabled={busy} onClick={() => deliver.mutate()}>
            {deliver.isPending ? 'Saving…' : 'Mark delivered'}
          </Button>
        )}

        {canCancel &&
          (confirmingCancel ? (
            <div
              className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3"
              data-testid="cancel-confirm"
            >
              <p className="text-sm text-red-800">
                Cancel this round? Residents' pledges will no longer be fulfilled. This cannot be
                undone.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  disabled={busy}
                  onClick={() => cancel.mutate(undefined, { onSettled: () => setConfirmingCancel(false) })}
                >
                  {cancel.isPending ? 'Cancelling…' : 'Yes, cancel round'}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setConfirmingCancel(false)}>
                  Keep round
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              disabled={busy}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel round
            </Button>
          ))}

        {[close, deliver, cancel].map((mutation, index) =>
          mutation.isError ? (
            <p key={index} role="alert" className="text-sm text-red-600">
              {errorMessage(mutation.error)}
            </p>
          ) : null,
        )}
      </div>
    </Card>
  );
}

/** Participants with amounts due and (once a vendor is assigned) payment toggles. */
function Participants({ round }: { round: AdminRoundDetailDto }) {
  const payment = useSetPayment(round.id);
  const payable = PAYABLE.includes(round.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants</CardTitle>
        {payable && (
          <CardDescription data-testid="payment-summary">
            {round.payments.collectedCount} of {round.payments.participantsCount} paid ·{' '}
            {formatRupees(round.payments.collectedAmount)} collected ·{' '}
            {formatRupees(round.payments.outstandingAmount)} outstanding
          </CardDescription>
        )}
      </CardHeader>

      {round.participants.length === 0 ? (
        <p className="text-sm text-slate-500">No residents have joined this round.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Resident</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3 text-right">Units</th>
                <th className="py-2 pr-3 text-right">Amount due</th>
                <th className="py-2 pr-3">Rating</th>
                {payable && <th className="py-2">Payment</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {round.participants.map((participant) => {
                const name = participant.resident.name ?? 'Resident';
                return (
                  <tr key={participant.id} data-testid="participant-row">
                    <td className="py-2 pr-3 font-medium text-slate-900">{name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{participant.resident.phone}</td>
                    <td className="py-2 pr-3 text-right">{participant.units}</td>
                    <td className="py-2 pr-3 text-right">
                      {participant.amountDue === null ? '—' : formatRupees(participant.amountDue)}
                    </td>
                    <td className="py-2 pr-3" data-testid="participant-rating">
                      {participant.rating ? (
                        <span>
                          <span className="whitespace-nowrap font-medium text-slate-900">
                            {participant.rating.stars} / 5
                          </span>
                          {participant.rating.comment && (
                            <span className="block text-xs text-slate-500">
                              “{participant.rating.comment}”
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    {payable && (
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              participant.paymentCollected
                                ? 'text-xs font-semibold text-green-700'
                                : 'text-xs font-semibold text-slate-500'
                            }
                          >
                            {participant.paymentCollected ? 'Collected' : 'Pending'}
                          </span>
                          <Button
                            variant="ghost"
                            className="h-9 border border-slate-300 px-3"
                            disabled={payment.isPending}
                            aria-label={
                              participant.paymentCollected
                                ? `Undo payment for ${name}`
                                : `Mark collected for ${name}`
                            }
                            onClick={() =>
                              payment.mutate({
                                participantId: participant.id,
                                collected: !participant.paymentCollected,
                              })
                            }
                          >
                            {participant.paymentCollected ? 'Undo' : 'Mark collected'}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payment.isError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {errorMessage(payment.error)}
        </p>
      )}
    </Card>
  );
}

/**
 * Super-admin round detail (FEAT-005): the round's facts, the actions valid for its
 * current status only, and per-participant payment tracking (ADR-0012).
 */
export function AdminRoundDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useAdminRound(id);

  return (
    <AdminLayout title="Round">
      <Link to="/admin" className="text-sm font-semibold text-teal-700 hover:underline">
        ← All rounds
      </Link>

      {isLoading && <p className="text-slate-500">Loading round…</p>}

      {isError && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-red-600">
            {error instanceof ApiError && error.status === 404
              ? 'This round does not exist.'
              : "We couldn't load this round. Please try again."}
          </p>
          <Button onClick={() => void refetch()}>Retry</Button>
        </div>
      )}

      {data && (
        <>
          <RoundSummary round={data} />
          <RoundActions round={data} />
          <Participants round={data} />
        </>
      )}
    </AdminLayout>
  );
}
