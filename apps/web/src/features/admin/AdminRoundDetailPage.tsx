import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useIsMutating } from '@tanstack/react-query';
import type {
  RoundServiceSummary, AdminRoundDetailDto, RoundStatus,
  RoundTierDto,
} from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { ConfirmSheet } from '../../components/ui/confirm-sheet';
import { Fact } from '../../components/ui/fact';
import { Field } from '../../components/ui/field';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { ApiError } from '../../lib/api';
import { AdminLayout } from './AdminLayout';
import { errorMessage, formatDateTime, formatRupees } from './adminFormat';
import { OFFLINE_QUEUED_TEXT, OFFLINE_WAITING_LABEL, queryStalled } from '../../lib/offline';
import { capitalise, formatUnits, unitLabelFor, unitLabelPluralFor } from '../../lib/units';
import { formatRatingSummary } from '../rating/formatRating';
import { StatusBadge } from './StatusBadge';
import { parseTiers, TierFields, useTierRows } from './RoundTierFields';
import {
  adminKeys,
  useAdminRound,
  useAssignRound,
  useCancelRound,
  useCloseRound,
  useDeliverRound,
  useSetPayment,
  useAllVendors,
  useUpdateRound,
  useReopenRound,
} from './useAdmin';

/** Final price bounds (integer ₹ per unit), mirroring the backend AssignRoundBody validation. */
const MIN_FINAL_PRICE = 1;
const MAX_FINAL_PRICE = 1_000_000;

/** Statuses from which the admin may cancel (anything before DELIVERED that isn't terminal). */
const CANCELLABLE: RoundStatus[] = ['OPEN', 'CLOSED_MET', 'CLOSED_EXPIRED', 'ASSIGNED'];

/** Statuses where a vendor is assigned, so payments can be collected. */
const PAYABLE: RoundStatus[] = ['ASSIGNED', 'DELIVERED', 'RATED'];

/** Round header: service, society, status, deadline, units, tiers, prices, vendor, delivery. */
function RoundSummary({ round }: { round: AdminRoundDetailDto }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-eyebrow uppercase text-brand-ink">
            {round.service.category}
          </span>
          <h2 className="mt-1.5 text-headline font-extrabold tracking-[-0.035em] text-ink">{round.service.name}</h2>
          <p className="mt-1 text-caption text-ink-muted">
            {round.society.name}, {round.society.city}
          </p>
        </div>
        <StatusBadge status={round.status} />
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Fact variant="plain" term="Deadline">{formatDateTime(round.deadline)}</Fact>
        <Fact variant="plain" term={`${capitalise(unitLabelPluralFor(round.service))} / residents`}>
          {round.unitsCount} / {round.participantsCount}
        </Fact>
        <Fact variant="plain" term="Current price">
          {formatRupees(round.currentPrice)} / {unitLabelFor(round.service)}
        </Fact>
        <Fact variant="plain" term="Rating">
          <span data-testid="round-rating">{formatRatingSummary(round.ratings)}</span>
        </Fact>
        <Fact variant="plain" term="Tiers">
          <ul>
            {round.tiers.map((tier) => (
              <li key={tier.threshold}>
                {/* V2 P1-A: this said "units" two lines below "Rooms / residents". */}
                {formatUnits(tier.threshold, round.service)}+: {formatRupees(tier.price)}
              </li>
            ))}
          </ul>
        </Fact>
        {round.vendor && (
          <Fact variant="plain" term="Vendor">
            {round.vendor.name}
            <span className="num block text-meta text-ink-muted">{round.vendor.phone}</span>
          </Fact>
        )}
        {round.finalPrice !== null && (
          <Fact variant="plain" term="Final price">
            <span data-testid="final-price">{formatRupees(round.finalPrice)}</span>
          </Fact>
        )}
        {round.assignedAt && <Fact variant="plain" term="Assigned">{formatDateTime(round.assignedAt)}</Fact>}
        {round.deliveredAt && <Fact variant="plain" term="Delivered">{formatDateTime(round.deliveredAt)}</Fact>}
      </dl>
    </Card>
  );
}

/** Vendor + final price form for a CLOSED_MET round. Submit stays disabled until valid. */
function AssignForm({
  roundId,
  busy,
  service,
}: {
  roundId: string;
  busy: boolean;
  /** V2 P1-B: the negotiated price is per WHAT — this is the field `amountDue` bills. */
  service: RoundServiceSummary;
}) {
  const vendors = useAllVendors();
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
    return (
      <SkeletonScreen label="Loading vendors…" testId="assign-skeleton" className="flex flex-col gap-3">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton radius="control" className="h-control w-full" delay={1} />
      </SkeletonScreen>
    );
  }
  // BUG-004 (V2 P0-1): offline PAUSES this read, so `isError` alone let it fall
  // through to the "No active vendors" branch below — telling the admin something
  // false, whose obvious remedy is to go and create a duplicate vendor.
  if (queryStalled(vendors)) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-meta font-bold text-danger-ink" data-testid="vendors-unavailable">
          {vendors.isError
            ? "We couldn't load vendors. Please try again."
            : "You're offline, so we couldn't load the vendor list. Reconnect to assign this round."}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void vendors.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (activeVendors.length === 0) {
    return (
      <p className="text-caption text-ink-muted" data-testid="no-active-vendors">
        No active vendors.{' '}
        <Link to="/admin/vendors" className="font-extrabold text-brand-ink hover:underline">
          Add a vendor
        </Link>{' '}
        to assign this round.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-label="Assign vendor">
      <Field label="Vendor" id="assign-vendor">
        {(props) => (
          <Select {...props} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select a vendor</option>
            {activeVendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
                {vendor.category ? ` (${vendor.category})` : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {/* The price error goes through Field, which wires aria-describedby to it. It
          was a bare <p> beside an aria-invalid input: a screen reader announced
          "invalid" and never read why (V2 P2-1). */}
      <Field
        label={`Final price per ${unitLabelFor(service)} (₹)`}
        id="assign-price"
        error={finalPrice !== '' && !priceValid ? 'Enter a whole number from 1 to 10,00,000.' : null}
      >
        {(props) => (
          <Input
            {...props}
            type="number"
            inputMode="numeric"
            min={MIN_FINAL_PRICE}
            max={MAX_FINAL_PRICE}
            step={1}
            value={finalPrice}
            onChange={(e) => setFinalPrice(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" disabled={!valid || busy || assign.isPending}>
        {assign.isPaused ? OFFLINE_WAITING_LABEL : assign.isPending ? 'Assigning…' : 'Assign vendor'}
      </Button>
      {assign.isError && (
        <p role="alert" className="flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink">
          {errorMessage(assign.error)}
        </p>
      )}
    </form>
  );
}

/**
 * Status-driven actions: Close (OPEN), Assign (CLOSED_MET), Deliver (ASSIGNED) and
 * Cancel asks first through the shared ConfirmSheet (any pre-DELIVERED, non-terminal status).
 */
function RoundActions({ round }: { round: AdminRoundDetailDto }) {
  const close = useCloseRound(round.id);
  const deliver = useDeliverRound(round.id);
  const cancel = useCancelRound(round.id);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // FEAT-039 (ADR-0048): a reason is required to cancel.
  const [cancelReason, setCancelReason] = useState('');
  const reasonOk = cancelReason.trim().length >= 3;

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
            {close.isPaused ? OFFLINE_WAITING_LABEL : close.isPending ? 'Closing…' : 'Close round'}
          </Button>
        )}

        {round.status === 'CLOSED_MET' && (
          <AssignForm roundId={round.id} busy={busy} service={round.service} />
        )}

        {round.status === 'ASSIGNED' && (
          <Button disabled={busy} onClick={() => deliver.mutate()}>
            {deliver.isPaused ? OFFLINE_WAITING_LABEL : deliver.isPending ? 'Saving…' : 'Mark delivered'}
          </Button>
        )}

        {canCancel && (
          <Button variant="danger" disabled={busy} aria-haspopup="dialog" onClick={() => setConfirmingCancel(true)}>
            {cancel.isPaused ? OFFLINE_WAITING_LABEL : cancel.isPending ? 'Cancelling…' : 'Cancel round'}
          </Button>
        )}
        {/* FEAT-024: the same confirmation the resident gets — one sheet, not a hand-rolled box. */}
        <ConfirmSheet
          open={confirmingCancel}
          onClose={() => setConfirmingCancel(false)}
          title="Cancel this round?"
          consequence="Everyone who pledged is told it was cancelled and that there's nothing to pay. If no vendor was assigned, you can reopen it later."
          confirmLabel="Yes, cancel round"
          pendingLabel={cancel.isPaused ? OFFLINE_WAITING_LABEL : 'Cancelling…'}
          keepLabel="Keep round"
          busy={cancel.isPending}
          error={cancel.isError ? errorMessage(cancel.error) : null}
          // onSuccess, not onSettled (V2 r2): a refused cancel keeps the sheet open with its error.
          onConfirm={() => cancel.mutate(cancelReason.trim(), { onSuccess: () => { setConfirmingCancel(false); setCancelReason(''); } })}
          confirmDisabled={!reasonOk}
          data-testid="cancel-confirm"
        >
          <Field label="Reason (required)" id="cancel-reason" hint="Admins see this, and residents see it in the app.">
            {(props) => (
              <Input
                {...props}
                value={cancelReason}
                maxLength={300}
                placeholder="e.g. The vendor isn't available that week"
                onChange={(e) => setCancelReason(e.target.value)}
                data-testid="cancel-reason"
              />
            )}
          </Field>
        </ConfirmSheet>

        {[close, deliver, cancel].map((mutation, index) =>
          mutation.isError ? (
            <p key={index} role="alert" className="text-meta font-bold text-danger-ink">
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

      {/* The participants list stays a real <table> — the exception ADR-0022 records:
          it IS tabular data with six columns, the unit word lives in a columnheader
          that FEAT-010 asserts, and a screen reader reads a table better than a list
          of rows. The cost is accepted and named: it scrolls sideways on a phone. */}
      {round.participants.length === 0 ? (
        <p className="mt-1 text-caption text-ink-muted">No residents have joined this round.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-caption">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              <tr>
                <th className="py-2 pr-3">Resident</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3 text-right">
                  {capitalise(unitLabelPluralFor(round.service))}
                </th>
                <th className="py-2 pr-3 text-right">Amount due</th>
                <th className="py-2 pr-3">Rating</th>
                {payable && <th className="py-2">Payment</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/10">
              {round.participants.map((participant) => {
                const name = participant.resident.name ?? 'Resident';
                return (
                  <tr key={participant.id} data-testid="participant-row">
                    <td className="py-3 pr-3 font-bold text-ink">{name}</td>
                    <td className="num py-3 pr-3 whitespace-nowrap text-ink-muted">{participant.resident.phone}</td>
                    <td className="py-2 pr-3 text-right">{participant.units}</td>
                    <td className="py-2 pr-3 text-right">
                      {participant.amountDue === null ? '—' : formatRupees(participant.amountDue)}
                    </td>
                    <td className="py-2 pr-3" data-testid="participant-rating">
                      {participant.rating ? (
                        <span>
                          <span className="whitespace-nowrap font-bold text-ink">
                            {participant.rating.stars} / 5
                          </span>
                          {participant.rating.comment && (
                            <span className="block text-micro text-ink-soft">
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
                                ? 'text-micro font-extrabold text-success-ink'
                                : 'text-micro font-extrabold text-ink-soft'
                            }
                          >
                            {participant.paymentCollected ? 'Collected' : 'Pending'}
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
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

      {payment.isPaused && (
        <p role="status" data-testid="payment-offline" className="mt-3 flex items-center gap-2 rounded-chip border border-paper/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink">
          {OFFLINE_QUEUED_TEXT}
        </p>
      )}
      {payment.isError && (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink">
          {errorMessage(payment.error)}
        </p>
      )}
    </Card>
  );
}

/** `2026-11-25T18:30` for a datetime-local input, in the admin's own time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * FEAT-038 (ADR-0047): change an OPEN round's deadline and price tiers. Society and service stay;
 * to change those, cancel and open a new round. Pledges are kept, and the price is re-derived.
 */
function EditRound({ round }: { round: AdminRoundDetailDto }) {
  const update = useUpdateRound(round.id);
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState(() => toLocalInput(round.deadline));
  const tiers = useTierRows(round.tiers);
  const [formError, setFormError] = useState<string | null>(null);

  function start() {
    setDeadline(toLocalInput(round.deadline));
    tiers.reset(round.tiers);
    setFormError(null);
    update.reset();
    setOpen(true);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const deadlineDate = new Date(deadline);
    if (deadline === '' || Number.isNaN(deadlineDate.getTime())) {
      setFormError('Choose a deadline.');
      return;
    }
    const deadlineChanged = deadline !== toLocalInput(round.deadline);
    // V2 P2-3: validate the tiers only if they were touched. A round stored before BUG-030 (prices
    // that rise) can still have just its deadline moved.
    const raw = (rows: Array<{ threshold: string | number; price: string | number }>) =>
      JSON.stringify(rows.map((r) => [String(r.threshold).trim(), String(r.price).trim()]));
    const tiersChanged = raw(tiers.rows) !== raw(round.tiers);
    let parsedTiers: RoundTierDto[] | undefined;
    if (tiersChanged) {
      const parsed = parseTiers(tiers.rows);
      if ('error' in parsed) {
        setFormError(parsed.error);
        return;
      }
      parsedTiers = parsed.tiers;
    }
    setFormError(null);
    if (!deadlineChanged && !tiersChanged) {
      setOpen(false);
      return;
    }
    update.mutate(
      { ...(deadlineChanged ? { deadline: deadlineDate.toISOString() } : {}), ...(parsedTiers ? { tiers: parsedTiers } : {}) },
      { onSuccess: () => setOpen(false) },
    );
  }

  if (round.status !== 'OPEN') return null;
  return (
    <Card data-testid="edit-round">
      <CardHeader>
        <CardTitle>Edit round</CardTitle>
        <CardDescription>
          Change the deadline or the price tiers while the round is open. Pledges are kept. To change the society or
          service, cancel this round and open a new one.
        </CardDescription>
      </CardHeader>
      {!open ? (
        <Button variant="secondary" className="self-start" onClick={start} data-testid="edit-round-open">
          Edit deadline and tiers
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Edit round" noValidate>
          <Field label="Deadline" id="edit-round-deadline">
            {(props) => <Input {...props} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
          </Field>
          <TierFields
            idPrefix="edit-tier"
            rows={tiers.rows}
            unit={unitLabelFor(round.service)}
            unitPlural={unitLabelPluralFor(round.service)}
            onChange={tiers.update}
            onAdd={tiers.add}
            onRemove={tiers.remove}
          />
          {(formError || update.isError) && (
            <p role="alert" className="rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink">
              {formError ?? errorMessage(update.error)}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={update.isPending} data-testid="edit-round-save">
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={update.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {!open && update.isSuccess && (
        <p role="status" className="mt-3 text-meta font-bold text-brand-ink">
          Saved
        </p>
      )}
    </Card>
  );
}

/**
 * FEAT-039 (ADR-0048): a CANCELLED round shows why, and can be reopened with a new deadline when
 * it never had a vendor or a collected payment. Pledges are kept; their owners are told.
 */
function CancelledRound({ round }: { round: AdminRoundDetailDto }) {
  const reopen = useReopenRound(round.id);
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  if (round.status !== 'CANCELLED') return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const at = new Date(deadline);
    if (deadline === '' || Number.isNaN(at.getTime())) {
      setFormError('Choose a new deadline.');
      return;
    }
    if (at.getTime() <= Date.now()) {
      setFormError('The new deadline must be in the future.');
      return;
    }
    setFormError(null);
    reopen.mutate(at.toISOString());
  }

  return (
    <Card data-testid="cancelled-round">
      <CardHeader>
        <CardTitle>Cancelled</CardTitle>
        <CardDescription data-testid="cancel-reason-shown">
          {round.cancelReason ? `Reason: ${round.cancelReason}` : 'No reason was recorded.'}
          {round.cancelledAt ? ` · ${formatDateTime(round.cancelledAt)}` : ''}
        </CardDescription>
      </CardHeader>
      {round.canReopen ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-label="Reopen round" noValidate>
          <p className="text-meta text-ink-muted">
            Reopen it with a new deadline. {round.unitsCount > 0 ? `The ${round.participantsCount} resident(s) who pledged keep their pledge and are told it is open again.` : ''}
          </p>
          <Field label="New deadline" id="reopen-deadline">
            {(props) => <Input {...props} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
          </Field>
          {(formError || reopen.isError) && (
            <p role="alert" className="rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink">
              {formError ?? errorMessage(reopen.error)}
            </p>
          )}
          <Button type="submit" className="self-start" disabled={reopen.isPending} data-testid="reopen-round">
            {reopen.isPending ? 'Reopening…' : 'Reopen round'}
          </Button>
        </form>
      ) : (
        <p className="text-meta text-ink-muted" data-testid="reopen-blocked">
          This round had a vendor or collected payments, so it can&apos;t be reopened. Open a new round instead.
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
  const roundQuery = useAdminRound(id);
  const { data, isLoading, error, refetch } = roundQuery;
  // BUG-004 (V2 P0-1): paused counts as failed, or an offline cold load renders the
  // layout and the back link and NOTHING else — no error, no Retry.
  const isError = queryStalled(roundQuery);

  return (
    <AdminLayout title="Round">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-meta font-extrabold text-brand-ink hover:underline">
        ← All rounds
      </Link>

      {isLoading && (
        <SkeletonScreen label="Loading round…" testId="round-skeleton" className="flex flex-col gap-4">
          <div className="surface-glass rounded-card p-6">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="mt-3 h-5 w-1/3" delay={1} />
            <Skeleton radius="inset" className="mt-5 h-20 w-full" delay={2} />
          </div>
          <div className="surface-solid rounded-card p-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton radius="inset" className="mt-4 h-24 w-full" delay={1} />
          </div>
        </SkeletonScreen>
      )}

      {isError && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="flex gap-2.5 text-meta font-bold text-danger-ink">
            {error instanceof ApiError && error.status === 404
              ? 'This round does not exist.'
              : roundQuery.isError
                ? "We couldn't load this round. Please try again."
                : "You're offline, so we couldn't load this round. Reconnect and try again."}
          </p>
          <Button onClick={() => void refetch()}>Retry</Button>
        </div>
      )}

      {data && (
        <>
          <RoundSummary round={data} />
          <EditRound round={data} />
          <CancelledRound round={data} />
          <RoundActions round={data} />
          <Participants round={data} />
        </>
      )}
    </AdminLayout>
  );
}
