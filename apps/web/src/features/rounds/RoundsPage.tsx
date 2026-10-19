import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { RoundDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Badge } from '../../components/ui/badge';
import { QueryErrorState } from '../../components/QueryState';
import { OFFLINE_QUEUED_TEXT, OFFLINE_WAITING_LABEL, anyPaused, hasRows, queryStalled } from '../../lib/offline';
import { Card, CardEyebrow, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Sheet } from '../../components/ui/sheet';
import { ConfirmSheet } from '../../components/ui/confirm-sheet';
import { Sparkles } from '../../components/ui/sparkles';
import { Notice } from '../../components/ui/notice';
import { formatClock, formatCountdown } from './formatCountdown';
import { formatRupees } from './formatPrice';
import { capitalise, formatUnits, unitLabelFor, unitLabelPluralFor } from '../../lib/units';
import { useJoinRound, useLeaveRound, useRounds, useUpdatePledge } from './useRounds';
import { TierRing } from './TierRing';
import { useCountUp } from './useCountUp';
import { RoundsSkeleton } from './RoundsSkeleton';
import { PriceLadder } from './PriceLadder';
import { RoundsSummary } from './RoundsSummary';
import { PushPrompt } from '../push/PushPrompt';
import { InviteButton } from './InviteButton';
import { Celebrate } from './Celebrate';
import { useDeadlineClock } from './useDeadlineClock';
import { Toast } from '../../components/ui/toast';
import { ShowMore } from '../../components/ui/show-more';
import { reachedTiers } from './roundMath';

/** Units a single resident may pledge (mirrors the backend MAX_UNITS_PER_RESIDENT guard). */
const MIN_UNITS = 1;
const MAX_UNITS = 50;

/** Clamp a units value into the allowed [MIN_UNITS, MAX_UNITS] range. */
function clampUnits(units: number): number {
  if (Number.isNaN(units)) {
    return MIN_UNITS;
  }
  return Math.min(MAX_UNITS, Math.max(MIN_UNITS, Math.trunc(units)));
}

/** Progress of the live unit count toward the next tier (0–100), full at the top tier. */
function tierProgress(round: RoundDto): number {
  if (!round.nextTier) {
    return 100;
  }
  return Math.min(100, Math.round((round.unitsCount / round.nextTier.threshold) * 100));
}

/** The queued/failed pair every pledge control shows under itself, unchanged from FEAT-003. */
function PledgeNotices({ paused, failed }: { paused: boolean; failed: boolean }) {
  return (
    <>
      {paused && (
        <p
          role="status"
          data-testid="pledge-paused"
          className="flex items-center gap-2 rounded-chip border border-paper/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink"
        >
          <Icon name="offline" size={16} strokeWidth={2} />
          {OFFLINE_QUEUED_TEXT}
        </p>
      )}
      {failed && !paused && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-chip border border-paper/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink"
        >
          <Icon name="alert" size={16} strokeWidth={2} />
          Couldn&apos;t update your pledge. Please try again.
        </p>
      )}
    </>
  );
}

/**
 * The pledge control for one round (FEAT-016): what the resident has pledged, and ONE
 * button that opens the pledge sheet — "Join" or "Change". The sheet is where units are
 * chosen and a price is previewed; nothing is sent until its one action is pressed.
 */
function JoinControl({
  round,
  onSaved,
  onInvited,
  startOpen = false,
}: {
  round: RoundDto;
  onSaved: (saved: RoundDto) => void;
  onInvited: (message: string) => void;
  /** FEAT-021: arrived from the catalog to book this round — the sheet opens at once. */
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  // A request that arrives while this card is already on screen opens it too (V2 r2 P3).
  const [seenStartOpen, setSeenStartOpen] = useState(startOpen);
  if (startOpen !== seenStartOpen) {
    setSeenStartOpen(startOpen);
    if (startOpen) setOpen(true);
  }
  const joined = round.myUnits > 0;
  // The writes live HERE, not in the sheet, so a pledge queued offline still says so on
  // the card after the sheet is closed (V2 P2-3).
  const join = useJoinRound();
  const update = useUpdatePledge();
  const leave = useLeaveRound();
  const paused = anyPaused(join, update, leave);
  const failed = join.isError || update.isError || leave.isError;

  function openSheet() {
    // A failure from an earlier attempt should not greet the next one.
    for (const m of [join, update, leave]) if (!m.isPending) m.reset();
    setOpen(true);
  }
  return (
    <>
      <div className="flex items-center gap-3">
        {joined ? (
          <p className="min-w-0 flex-1 text-meta font-bold text-ink-muted" data-testid={`my-units-${round.id}`}>
            You&apos;ve pledged{' '}
            <span className="num font-extrabold text-brand-ink">{formatUnits(round.myUnits, round.service)}</span>
          </p>
        ) : (
          <p className="min-w-0 flex-1 text-meta text-ink-muted">
            Pledge the {unitLabelPluralFor(round.service)} you need. You pay only if it goes ahead.
          </p>
        )}
        <Button
          variant={joined ? 'secondary' : 'primary'}
          size="sm"
          aria-haspopup="dialog"
          onClick={openSheet}
          data-testid={`pledge-open-${round.id}`}
        >
          {joined ? 'Change' : 'Join'}
        </Button>
        <InviteButton round={round} onMessage={onInvited} />
      </div>
      {/* What happened to a write after the sheet was closed — queued offline, or refused
          once it reached the server (V2 round 2). Inside the sheet, the sheet says it. */}
      {(paused || failed) && !open && (
        <div className="mt-3">
          <PledgeNotices paused={paused} failed={failed} />
        </div>
      )}
      <PledgeSheet
        round={round}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={onSaved}
        mutations={{ join, update, leave }}
      />
    </>
  );
}

/**
 * The pledge sheet (FEAT-016): a big stepper, what one unit includes, and the price —
 * today's and the next tier's — for the number being chosen. Adjusting is free; the one
 * action at the bottom commits it, and the sheet closes when the server agrees.
 */
function PledgeSheet({
  round,
  open,
  onClose,
  onSaved,
  mutations: { join, update, leave },
}: {
  round: RoundDto;
  open: boolean;
  onClose: () => void;
  /** A join or a change the server accepted — the card celebrates it (FEAT-018). */
  onSaved: (saved: RoundDto) => void;
  mutations: {
    join: ReturnType<typeof useJoinRound>;
    update: ReturnType<typeof useUpdatePledge>;
    leave: ReturnType<typeof useLeaveRound>;
  };
}) {
  const joined = round.myUnits > 0;
  const [draft, setDraft] = useState<number>(joined ? round.myUnits : MIN_UNITS);
  // FEAT-024: leaving asks first — a pledge is a place in the price ladder for everyone.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [seenOpen, setSeenOpen] = useState(open);
  // Each opening starts from what is pledged now, not from an abandoned draft.
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) setDraft(joined ? round.myUnits : MIN_UNITS);
  }
  const busy = join.isPending || update.isPending || leave.isPending;
  const failed = join.isError || update.isError || leave.isError;
  // A paused (offline) write is not a failure — it resumes on reconnect (CHORE-005).
  const paused = anyPaused(join, update, leave);
  const plural = unitLabelPluralFor(round.service);
  const units = clampUnits(draft);
  const saved = {
    onSuccess: (round: RoundDto) => {
      onClose();
      onSaved(round);
    },
  };

  const commit = joined
    ? () => update.mutate({ id: round.id, units }, saved)
    : () => join.mutate({ id: round.id, units }, saved);
  const unchanged = joined && units === round.myUnits;
  const cheaper = round.nextTier && round.nextTier.price < round.currentPrice ? round.nextTier : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={joined ? 'Your pledge' : `Join ${round.service.name}`}
      description={round.service.unitDescription?.trim() || undefined}
      footer={
        <div className="flex flex-col gap-2.5">
          <PledgeNotices paused={paused} failed={failed} />
          <Button className="w-full" disabled={busy || unchanged} onClick={commit} data-testid={joined ? `update-${round.id}` : `join-${round.id}`}>
            {join.isPending || update.isPending
              ? 'Saving…'
              : joined
                ? `Update to ${formatUnits(units, round.service)}`
                : `Join with ${formatUnits(units, round.service)}`}
          </Button>
          {joined && (
            <Button
              // The danger VARIANT, not ghost + a colour class: a caller's text colour
              // lost to the variant's own (stylesheet order), and "Leave" read as an
              // ordinary action (FEAT-016 browser pass).
              variant="danger"
              className="w-full"
              disabled={busy}
              aria-haspopup="dialog"
              onClick={() => setConfirmLeave(true)}
              data-testid={`leave-${round.id}`}
            >
              {leave.isPending ? 'Leaving…' : 'Leave this round'}
            </Button>
          )}
          <ConfirmSheet
            open={confirmLeave}
            // Always closable (V2 P1): offline, a paused mutation stays pending for as long as the
            // connection is gone; the sheet must not hold the person with it.
            onClose={() => setConfirmLeave(false)}
            title="Leave this round?"
            consequence={`Your pledge of ${formatUnits(round.myUnits, round.service)} is withdrawn, and the price for everyone may change.`}
            confirmLabel="Yes, leave"
            pendingLabel={leave.isPaused ? OFFLINE_WAITING_LABEL : 'Leaving…'}
            keepLabel="Keep my pledge"
            busy={leave.isPending}
            error={leave.isError ? 'Could not leave just now. Please try again.' : null}
            onConfirm={() => leave.mutate(round.id, { onSuccess: () => { setConfirmLeave(false); onClose(); } })}
            data-testid={`leave-confirm-${round.id}`}
          />
        </div>
      }
    >
      <div className="flex flex-col items-center gap-5">
        <div className="field flex flex-col items-center gap-2">
          <Label htmlFor={`units-${round.id}`}>
            {/* FEAT-010: the service's own word, capitalised for a form label. */}
            {capitalise(plural)}
          </Label>
          {/* The stepper reads as one control: a tray holding −, the count, and +. */}
          <div className="surface-inset flex items-center gap-2 rounded-tile p-1.5">
            <Button
              variant="secondary"
              size="icon"
              aria-label={`Decrease ${plural}`}
              disabled={busy || units <= MIN_UNITS}
              onClick={() => setDraft(clampUnits(units - 1))}
              data-testid={`decrement-${round.id}`}
            >
              <Icon name="minus" size={20} strokeWidth={2.3} />
            </Button>
            <div className="w-[88px]">
              <Input
                textSize="xl"
                id={`units-${round.id}`}
                type="number"
                inputMode="numeric"
                min={MIN_UNITS}
                max={MAX_UNITS}
                value={draft}
                onChange={(e) => setDraft(Number(e.target.value))}
                onBlur={() => setDraft(units)}
                data-testid={`units-input-${round.id}`}
                className="num text-center"
              />
            </div>
            <Button
              variant="secondary"
              size="icon"
              aria-label={`Increase ${plural}`}
              disabled={busy || units >= MAX_UNITS}
              onClick={() => setDraft(clampUnits(units + 1))}
              data-testid={`increment-${round.id}`}
            >
              <Icon name="plus" size={20} strokeWidth={2.3} />
            </Button>
          </div>
        </div>

        {/* What it comes to — the number a resident actually decides on. */}
        <dl className="grid w-full grid-cols-2 gap-2.5" data-testid={`pledge-preview-${round.id}`}>
          <div className="surface-inset rounded-inset px-3.5 py-3">
            <dt className="term-label">At today&apos;s price</dt>
            <dd key={units} className="num animate-tick mt-1 text-title font-extrabold text-ink">
              {formatRupees(round.currentPrice * units)}
            </dd>
            <dd className="text-micro text-ink-muted">
              {formatRupees(round.currentPrice)} / {unitLabelFor(round.service)}
            </dd>
          </div>
          <div className="surface-tint rounded-inset px-3.5 py-3">
            <dt className="term-label">{cheaper ? `At ${formatUnits(cheaper.threshold, round.service)}` : 'Best price'}</dt>
            <dd className="num mt-1 text-title font-extrabold text-brand-ink">
              {formatRupees((cheaper?.price ?? round.currentPrice) * units)}
            </dd>
            <dd className="text-micro text-ink-muted">
              {cheaper ? 'if the round gets there' : 'already unlocked'}
            </dd>
          </div>
        </dl>
      </div>
    </Sheet>
  );
}

/** The tier line: either the next price this round unlocks, or that it is at the best one. */
function TierLine({ round }: { round: RoundDto }) {
  if (!round.nextTier) {
    return (
      <span className="relative inline-block" data-testid={`top-tier-${round.id}`}>
        <SparkBurst />
        <Sparkles>
          <Badge tone="teal" icon={<Icon name="spark" size={13} strokeWidth={2.2} />} className="animate-pop">
            Best price unlocked
          </Badge>
        </Sparkles>
      </span>
    );
  }
  // CHORE-010: below the first threshold, `nextTier` is the FIRST tier, whose price is the
  // price already shown — "Unlocks ₹900" promised a saving that was not one. What that
  // tier actually means is the round's go/no-go line: a round closes as met only if it
  // reaches the lowest threshold (ADR-0011). So say that.
  const goesAhead = round.nextTier.price >= round.currentPrice;
  return (
    <p
      className="flex items-center gap-2 text-meta font-extrabold text-brand-ink"
      data-testid={`next-tier-${round.id}`}
    >
      <Icon name={goesAhead ? 'users' : 'trend'} size={15} strokeWidth={2.1} />
      {goesAhead
        ? `Goes ahead at ${formatUnits(round.nextTier.threshold, round.service)}`
        : `Unlocks ${formatRupees(round.nextTier.price)} at ${formatUnits(round.nextTier.threshold, round.service)}`}
    </p>
  );
}

/** Six sparks on the top tier — the one celebratory moment in the resident app. */
function SparkBurst() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (360 / 6) * index + 12;
        return (
          <span
            key={index}
            className="animate-burst absolute left-3.5 top-1/2 h-1.5 w-1.5 rounded-full bg-brand-light"
            style={{
              // CSS custom properties are the only way to give six copies of one
              // keyframe six different destinations.
              ['--dx' as string]: `${Math.round(Math.cos((angle * Math.PI) / 180) * 34)}px`,
              ['--dy' as string]: `${Math.round(Math.sin((angle * Math.PI) / 180) * 26)}px`,
              animationDelay: `${index * 90}ms`,
            }}
          />
        );
      })}
    </span>
  );
}

/** A single round card: service, live progress, current price, next-tier hint, deadline, join control. */
function RoundCard({
  round,
  lead,
  onInvited,
  requested = false,
}: {
  round: RoundDto;
  lead: boolean;
  onInvited: (message: string) => void;
  /** FEAT-021: the round the resident tapped in the catalog. */
  requested?: boolean;
}) {
  const progress = tierProgress(round);
  const liveCount = useCountUp(round.unitsCount);
  // "Closes in 6h" is a different kind of fact from "Closes in 4 days". Asked of the
  // deadline itself rather than by re-parsing the sentence just formatted from it.
  // FEAT-018: the last day ticks, once a second; further out, one timeout for when it starts.
  const { now, urgent } = useDeadlineClock(round.deadline);
  const closing = urgent ? formatClock(round.deadline, now) : formatCountdown(round.deadline);
  const joined = round.myUnits > 0;

  // FEAT-018: celebrate a saved pledge, and a tier reached while the card is on screen.
  // Tracked during render (as PledgeSheet tracks `open`), not in an effect.
  const reached = reachedTiers(round);
  const [seenReached, setSeenReached] = useState(reached);
  // The tier a saved pledge already celebrated: the refetch that follows a join brings
  // that same tier in, and celebrating it again restarted the confetti mid-flight (V2 P2-2).
  const [celebratedTier, setCelebratedTier] = useState(reached);
  const [burst, setBurst] = useState(0);
  if (reached !== seenReached) {
    setSeenReached(reached);
    if (reached > seenReached && reached > celebratedTier) {
      setCelebratedTier(reached);
      setBurst((n) => n + 1);
    }
    // A tier lost (someone left) can be won again, and should be celebrated again.
    if (reached < celebratedTier) setCelebratedTier(reached);
  }
  // When the last burst started. A poll can bring the new tier in BEFORE the response to the
  // join itself; the tier burst then plays, and the pledge burst must not restart it (V2 r2 P3-1).
  // (No apostrophes in this comment: check-css-classes pairs quotes across the file.)
  const lastBurstAt = useRef(0);
  useEffect(() => {
    if (burst > 0) lastBurstAt.current = Date.now();
  }, [burst]);
  function onSaved(saved: RoundDto | undefined) {
    // A pledge queued offline replays later, and what it resolves with is not guaranteed to
    // be a full round (an offline test resolves it with a bare body) — use it only if it is.
    if (saved && Array.isArray(saved.tiers)) {
      setCelebratedTier((tier) => Math.max(tier, reachedTiers(saved)));
    }
    if (Date.now() - lastBurstAt.current > 1_500) setBurst((n) => n + 1);
  }

  return (
    <Card padding="none"
      surface={lead ? 'glass' : 'solid'}
      // FEAT-019: the lead round gets the travelling border light.
      className={cn('relative overflow-hidden p-[22px]', lead && 'border-beam', requested && 'round-requested')}
      // FEAT-021: the target of `/rounds?join=<id>`.
      id={`round-${round.id}`}
      data-testid="round-card"
    >
      {lead && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-deep via-brand-light to-transparent"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardEyebrow>{round.service.category}</CardEyebrow>
          <CardTitle size="lg" className="mt-1.5">{round.service.name}</CardTitle>
          {joined && (
            <Badge
              tone="green"
              icon={<Icon name="check" size={13} strokeWidth={2.4} />}
              className="mt-2"
              data-testid={`joined-${round.id}`}
            >
              You&apos;re in
            </Badge>
          )}
        </div>
        <Badge
          tone={urgent ? 'amber' : 'slate'}
          icon={<Icon name="clock" size={13} strokeWidth={2.2} />}
          className={urgent ? 'num' : undefined}
          data-testid={`closing-${round.id}`}
        >
          {closing}
        </Badge>
      </div>

      <div className="mt-[18px] flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p data-testid={`price-${round.id}`}>
            <span className="num animate-blur-in inline-block text-amount font-extrabold text-ink">
              {formatRupees(round.currentPrice)}
            </span>
            {/* FEAT-010: a price is per WHAT — "₹3,500 / room", not a bare number. */}
            <span className="text-caption font-bold text-ink-soft">
              {' / '}
              {unitLabelFor(round.service)}
            </span>
          </p>
          <div className="mt-3">
            <TierLine round={round} />
          </div>
        </div>
        {/* The live count lives inside its own progress: one fact, not two. */}
        <div data-testid={`units-count-${round.id}`} className="relative shrink-0">
          <span className="sr-only-text">{formatUnits(round.unitsCount, round.service)} pledged</span>
          <TierRing
            label={`${round.service.name}: progress toward the next price`}
            percent={progress}
            value={liveCount}
            unitLabel={unitLabelPluralFor(round.service)}
            size={lead ? 108 : 92}
          />
          <Celebrate burst={burst} />
        </div>
      </div>

      <PriceLadder round={round} />

      {/* What one unit INCLUDES — the part that actually settles scope disputes
          (ADR-0019), shown where the resident decides whether to join. */}
      {round.service.unitDescription?.trim() && (
        <p
          className="surface-inset mt-4 rounded-inset px-3.5 py-3 text-meta text-ink-muted"
          data-testid={`unit-scope-${round.id}`}
        >
          {round.service.unitDescription}
        </p>
      )}

      <div className="mt-[17px] border-t border-line/10 pt-[17px]">
        <JoinControl round={round} onSaved={onSaved} onInvited={onInvited} startOpen={requested} />
      </div>
    </Card>
  );
}

/**
 * Resident rounds screen (FEAT-003). Lists the caller's society's OPEN group-buy
 * rounds as mobile-first cards with a live unit count, current tier price, the
 * next-tier hint, a deadline countdown and a join/update/leave control. Data comes
 * from `GET /rounds` via TanStack Query (polled for the live count); ProtectedRoute
 * guards it. Explicit loading / error / empty states.
 *
 * FEAT-011 moves the live count into a tier ring and gives the first round the lead
 * surface; the data, the polling and the controls are untouched.
 */
export function RoundsPage() {
  const navigate = useNavigate();
  const query = useRounds();
  const { data, isLoading, refetch } = query;
  const failed = queryStalled(query);
  // FEAT-018: one invite toast for the screen, not one per card (V2 P3-2). The dismiss
  // handler is stable: a new one every render restarted the toast's timer each second
  // on a ticking card, so it never went away (V2 P2-1).
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const dismissInvite = useCallback(() => setInviteMessage(null), []);

  // FEAT-021: `/rounds?join=<id>` — arrived from a service card to book it. The id is
  // kept (it drives the highlight and the open sheet) while the param is dropped from the
  // URL, so back and refresh do not reopen the sheet. A new `join` while mounted is adopted.
  const [searchParams, setSearchParams] = useSearchParams();
  const joinParam = searchParams.get('join');
  const [requested, setRequested] = useState(joinParam);
  if (joinParam && joinParam !== requested) setRequested(joinParam);
  // Scroll ONCE per navigation that carries `join` — not per render: `data` gets a new
  // reference on every poll, focus refetch and pledge, and re-scrolling dragged a resident
  // back from wherever they had moved to (V2 P1). Keyed on the navigation, so asking for
  // the same round again still scrolls and still clears the param (V2 r2 P3).
  const location = useLocation();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!joinParam || !data || handled.current === location.key) return;
    handled.current = location.key;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    document.getElementById(`round-${joinParam}`)?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.delete('join');
        return next;
      },
      { replace: true },
    );
  }, [joinParam, data, setSearchParams, location.key]);
  const requestedGone = Boolean(requested && data && !data.some((round) => round.id === requested));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-[22px]">
      <PageHeader
        collapsible
        title="Group buys"
        subtitle="Open rounds in your society"
        action={
          <Button variant="secondary" size="icon" aria-label="Back" onClick={() => navigate('/')}>
            <Icon name="back" size={20} strokeWidth={2.1} />
          </Button>
        }
      />

      {isLoading && <RoundsSkeleton />}

      {failed && <QueryErrorState subject="rounds" hasData={hasRows(data)} onRetry={() => void refetch()} />}

      {data && data.length === 0 && !failed && (
        <EmptyState
          icon="users"
          title="No open rounds yet"
          description="No open rounds in your society yet. Check back soon."
          data-testid="rounds-empty"
        />
      )}

      {requestedGone && (
        <Notice tone="warn" data-testid="join-gone">
          That group buy has closed or isn&apos;t open any more. Here is what is open now.
        </Notice>
      )}

      {data && data.length > 0 && <RoundsSummary rounds={data} total={query.total} />}

      {/* FEAT-020: the one contextual ask for notifications, once something is joined. */}
      {data && <PushPrompt joinedAny={data.some((round) => round.myUnits > 0)} />}

      {data && data.length > 0 && (
        <section className="stagger flex flex-col gap-3.5" aria-label="Open rounds">
          {data.map((round, index) => (
            <RoundCard
              key={round.id}
              round={round}
              lead={index === 0}
              onInvited={setInviteMessage}
              requested={round.id === requested}
            />
          ))}
          <ShowMore hasMore={query.hasMore} loaded={data.length} total={query.total} busy={query.loadingMore} onMore={query.loadMore} noun={['round', 'rounds']} />
        </section>
      )}

      <Toast onDismiss={dismissInvite} duration={4_000}>
        {inviteMessage}
      </Toast>
    </main>
  );
}
