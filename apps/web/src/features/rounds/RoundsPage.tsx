import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoundDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { Badge } from '../../components/ui/badge';
import { QueryErrorState } from '../../components/QueryState';
import { OFFLINE_QUEUED_TEXT, anyPaused, hasRows, queryStalled } from '../../lib/offline';
import { Card, CardEyebrow, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatCountdown } from './formatCountdown';
import { formatRupees } from './formatPrice';
import { capitalise, formatUnits, unitLabelFor, unitLabelPluralFor } from '../../lib/units';
import { useJoinRound, useLeaveRound, useRounds, useUpdatePledge } from './useRounds';
import { TierRing } from './TierRing';
import { useCountUp } from './useCountUp';
import { RoundsSkeleton } from './RoundsSkeleton';

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
          className="flex items-center gap-2 rounded-chip border border-white/60 bg-amber-ink/15 px-3 py-2 text-meta font-bold text-amber-ink"
        >
          <Icon name="offline" size={16} strokeWidth={2} />
          {OFFLINE_QUEUED_TEXT}
        </p>
      )}
      {failed && !paused && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-chip border border-white/55 bg-danger-ink/10 px-3 py-2 text-meta font-bold text-danger-ink"
        >
          <Icon name="alert" size={16} strokeWidth={2} />
          Couldn&apos;t update your pledge. Please try again.
        </p>
      )}
    </>
  );
}

/**
 * The join / update / leave control for one round. Instantiates its own mutation
 * hooks so pending + error state stay scoped to this card. When the caller has not
 * joined (`myUnits === 0`) it shows a units input + Join; once joined it shows the
 * pledged units with −/+ update and a Leave button.
 */
function JoinControl({ round }: { round: RoundDto }) {
  const [units, setUnits] = useState<number>(MIN_UNITS);
  const join = useJoinRound();
  const update = useUpdatePledge();
  const leave = useLeaveRound();

  const busy = join.isPending || update.isPending || leave.isPending;
  const failed = join.isError || update.isError || leave.isError;
  // A paused (offline) write is not a failure — it resumes on reconnect. Rule and
  // copy both come from lib/offline.ts so they cannot drift from the admin
  // controls that learned the same lesson in BUG-004 (CHORE-005).
  const paused = anyPaused(join, update, leave);

  if (round.myUnits === 0) {
    return (
      <div className="field flex flex-col gap-2.5">
        <div className="flex items-end gap-2.5">
          <div className="w-[98px]">
            <Label htmlFor={`units-${round.id}`}>
              {/* FEAT-010: the service's own word, capitalised for a form label. */}
              {capitalise(unitLabelPluralFor(round.service))}
            </Label>
            <Input
              id={`units-${round.id}`}
              type="number"
              inputMode="numeric"
              min={MIN_UNITS}
              max={MAX_UNITS}
              value={units}
              onChange={(e) => setUnits(clampUnits(Number(e.target.value)))}
              data-testid={`units-input-${round.id}`}
              className="num text-center text-[17px]"
            />
          </div>
          <Button
            className="flex-1"
            disabled={busy}
            onClick={() => join.mutate({ id: round.id, units: clampUnits(units) })}
            data-testid={`join-${round.id}`}
          >
            {join.isPending ? 'Joining…' : 'Join'}
          </Button>
        </div>
        <PledgeNotices paused={paused} failed={failed} />
      </div>
    );
  }

  const decrement = () => update.mutate({ id: round.id, units: clampUnits(round.myUnits - 1) });
  const increment = () => update.mutate({ id: round.id, units: clampUnits(round.myUnits + 1) });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-meta font-bold text-ink-muted" data-testid={`my-units-${round.id}`}>
        You&apos;ve pledged{' '}
        <span className="num font-extrabold text-brand-ink">
          {formatUnits(round.myUnits, round.service)}
        </span>
      </p>
      <div className="flex items-center gap-2.5">
        {/* The stepper reads as one control: a tray holding −, the count, and +. */}
        <div className="surface-inset flex items-center gap-1 rounded-inset p-1">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-chip"
            aria-label={`Decrease ${unitLabelPluralFor(round.service)}`}
            disabled={busy || round.myUnits <= MIN_UNITS}
            onClick={decrement}
            data-testid={`decrement-${round.id}`}
          >
            <Icon name="minus" size={18} strokeWidth={2.3} />
          </Button>
          <span className="num min-w-[30px] text-center text-[18px] font-extrabold text-ink">
            {round.myUnits}
          </span>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-chip"
            aria-label={`Increase ${unitLabelPluralFor(round.service)}`}
            disabled={busy || round.myUnits >= MAX_UNITS}
            onClick={increment}
            data-testid={`increment-${round.id}`}
          >
            <Icon name="plus" size={18} strokeWidth={2.3} />
          </Button>
        </div>
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          disabled={busy}
          onClick={() => leave.mutate(round.id)}
          data-testid={`leave-${round.id}`}
        >
          {leave.isPending ? 'Leaving…' : 'Leave'}
        </Button>
      </div>
      <PledgeNotices paused={paused} failed={failed} />
    </div>
  );
}

/** The tier line: either the next price this round unlocks, or that it is at the best one. */
function TierLine({ round }: { round: RoundDto }) {
  if (!round.nextTier) {
    return (
      <span className="relative inline-block" data-testid={`top-tier-${round.id}`}>
        <SparkBurst />
        <Badge tone="teal" icon={<Icon name="spark" size={13} strokeWidth={2.2} />} className="animate-pop">
          Best price unlocked
        </Badge>
      </span>
    );
  }
  return (
    <p
      className="flex items-center gap-2 text-meta font-extrabold text-brand-ink"
      data-testid={`next-tier-${round.id}`}
    >
      <Icon name="trend" size={15} strokeWidth={2.1} />
      Unlocks {formatRupees(round.nextTier.price)} at {formatUnits(round.nextTier.threshold, round.service)}
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
function RoundCard({ round, lead }: { round: RoundDto; lead: boolean }) {
  const progress = tierProgress(round);
  const liveCount = useCountUp(round.unitsCount);
  const closing = formatCountdown(round.deadline);
  // "Closes in 6h" is a different kind of fact from "Closes in 4 days". Asked of the
  // deadline itself rather than by re-parsing the sentence just formatted from it.
  const remainingMs = new Date(round.deadline).getTime() - Date.now();
  const urgent = remainingMs > 0 && remainingMs < 24 * 60 * 60 * 1000;

  return (
    <Card
      surface={lead ? 'glass' : 'solid'}
      className="relative overflow-hidden p-[22px]"
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
          <CardTitle className="mt-1.5 text-headline">{round.service.name}</CardTitle>
        </div>
        <Badge
          tone={urgent ? 'amber' : 'slate'}
          icon={<Icon name="clock" size={13} strokeWidth={2.2} />}
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
        <div data-testid={`units-count-${round.id}`} className="shrink-0">
          <span className="sr-only-text">{formatUnits(round.unitsCount, round.service)} pledged</span>
          <TierRing
            label={`${round.service.name}: progress toward the next price`}
            percent={progress}
            value={liveCount}
            unitLabel={unitLabelPluralFor(round.service)}
            size={lead ? 108 : 92}
          />
        </div>
      </div>

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

      <div className="mt-[17px] border-t border-shade/10 pt-[17px]">
        <JoinControl round={round} />
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

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-[22px]">
      <PageHeader
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

      {data && data.length > 0 && (
        <section className="stagger flex flex-col gap-3.5" aria-label="Open rounds">
          {data.map((round, index) => (
            <RoundCard key={round.id} round={round} lead={index === 0} />
          ))}
        </section>
      )}
    </main>
  );
}
