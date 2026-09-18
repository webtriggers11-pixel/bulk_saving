import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RoundDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { QueryErrorState } from '../../components/QueryState';
import { OFFLINE_QUEUED_TEXT, anyPaused, hasRows, queryStalled } from '../../lib/offline';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatCountdown } from './formatCountdown';
import { formatRupees } from './formatPrice';
import { useJoinRound, useLeaveRound, useRounds, useUpdatePledge } from './useRounds';

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
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <div className="w-24">
            <Label htmlFor={`units-${round.id}`}>Units</Label>
            <Input
              id={`units-${round.id}`}
              type="number"
              inputMode="numeric"
              min={MIN_UNITS}
              max={MAX_UNITS}
              value={units}
              onChange={(e) => setUnits(clampUnits(Number(e.target.value)))}
              data-testid={`units-input-${round.id}`}
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
        {paused && (
          <p role="status" data-testid="pledge-paused" className="text-sm text-amber-700">
            {OFFLINE_QUEUED_TEXT}
          </p>
        )}
        {failed && !paused && (
          <p role="alert" className="text-sm text-red-600">
            Couldn't update your pledge. Please try again.
          </p>
        )}
      </div>
    );
  }

  const decrement = () => update.mutate({ id: round.id, units: clampUnits(round.myUnits - 1) });
  const increment = () => update.mutate({ id: round.id, units: clampUnits(round.myUnits + 1) });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-700" data-testid={`my-units-${round.id}`}>
        You've pledged {round.myUnits} {round.myUnits === 1 ? 'unit' : 'units'}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          className="h-11 w-11 border border-slate-300 px-0 text-lg"
          aria-label="Decrease units"
          disabled={busy || round.myUnits <= MIN_UNITS}
          onClick={decrement}
          data-testid={`decrement-${round.id}`}
        >
          −
        </Button>
        <span className="w-8 text-center text-base font-semibold text-slate-900">
          {round.myUnits}
        </span>
        <Button
          variant="ghost"
          className="h-11 w-11 border border-slate-300 px-0 text-lg"
          aria-label="Increase units"
          disabled={busy || round.myUnits >= MAX_UNITS}
          onClick={increment}
          data-testid={`increment-${round.id}`}
        >
          +
        </Button>
        <Button
          variant="ghost"
          className="ml-auto text-red-600 hover:bg-red-50"
          disabled={busy}
          onClick={() => leave.mutate(round.id)}
          data-testid={`leave-${round.id}`}
        >
          {leave.isPending ? 'Leaving…' : 'Leave'}
        </Button>
      </div>
      {paused && (
        <p role="status" data-testid="pledge-paused" className="text-sm text-amber-700">
          {OFFLINE_QUEUED_TEXT}
        </p>
      )}
      {failed && !paused && (
        <p role="alert" className="text-sm text-red-600">
          Couldn't update your pledge. Please try again.
        </p>
      )}
    </div>
  );
}

/** A single round card: service, live progress, current price, next-tier hint, deadline, join control. */
function RoundCard({ round }: { round: RoundDto }) {
  const progress = tierProgress(round);
  return (
    <Card className="flex flex-col gap-4 p-5" data-testid="round-card">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          {round.service.category}
        </span>
        <h3 className="text-lg font-bold text-slate-900">{round.service.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{formatCountdown(round.deadline)}</p>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-slate-900" data-testid={`price-${round.id}`}>
            {formatRupees(round.currentPrice)}
          </span>
          <span className="text-sm text-slate-600" data-testid={`units-count-${round.id}`}>
            {round.unitsCount} {round.unitsCount === 1 ? 'unit' : 'units'} pledged
          </span>
        </div>

        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-teal-600" style={{ width: `${progress}%` }} />
        </div>

        {round.nextTier ? (
          <p className="mt-2 text-sm text-teal-700" data-testid={`next-tier-${round.id}`}>
            Unlocks {formatRupees(round.nextTier.price)} at {round.nextTier.threshold} units
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-teal-700" data-testid={`top-tier-${round.id}`}>
            Best price unlocked 🎉
          </p>
        )}
      </div>

      <JoinControl round={round} />
    </Card>
  );
}

/**
 * Resident rounds screen (FEAT-003). Lists the caller's society's OPEN group-buy
 * rounds as mobile-first cards with a live unit count, current tier price, the
 * next-tier hint, a deadline countdown and a join/update/leave control. Data comes
 * from `GET /rounds` via TanStack Query (polled for the live count); ProtectedRoute
 * guards it. Explicit loading / error / empty states.
 */
export function RoundsPage() {
  const navigate = useNavigate();
  const query = useRounds();
  const { data, isLoading, refetch } = query;
  const failed = queryStalled(query);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-50 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Group buys</h1>
          <p className="text-sm text-slate-500">Open rounds in your society</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Back
        </Button>
      </header>

      {isLoading && <p className="text-slate-500">Loading rounds…</p>}

      {failed && <QueryErrorState subject="rounds" hasData={hasRows(data)} onRetry={() => void refetch()} />}

      {data && data.length === 0 && !failed && (
        <Card data-testid="rounds-empty">
          <CardHeader>
            <CardTitle>No open rounds yet</CardTitle>
            <CardDescription>
              No open rounds in your society yet. Check back soon.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {data && data.length > 0 && (
        <section className="flex flex-col gap-4" aria-label="Open rounds">
          {data.map((round) => (
            <RoundCard key={round.id} round={round} />
          ))}
        </section>
      )}
    </main>
  );
}
