import { Link } from 'react-router-dom';
import type { MyRoundDto, RoundStatus } from '@bulk/shared';
import { QueryErrorState } from '../../components/QueryState';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { formatCountdown } from '../rounds/formatCountdown';
import { formatRupees } from '../rounds/formatPrice';
import { useMyRounds } from '../rounds/useRounds';
import { hasRows, queryStalled } from '../../lib/offline';
import { RateRound, isRateable } from '../rating/RateRound';

/**
 * What each lifecycle state means to the resident who joined (ADR-0011 owns the
 * transitions). Deliberately their language, not the enum's: a resident should
 * never have to decode CLOSED_EXPIRED.
 */
const STATUS_LABEL: Record<RoundStatus, string> = {
  OPEN: 'Open',
  CLOSED_MET: 'Target met',
  CLOSED_EXPIRED: 'Did not fill',
  ASSIGNED: 'Vendor booked',
  DELIVERED: 'Delivered',
  RATED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** One line saying what actually happens next, per state. */
function statusDetail(round: MyRoundDto): string {
  switch (round.status) {
    case 'OPEN':
      return formatCountdown(round.deadline);
    case 'CLOSED_MET':
      return 'Enough neighbours joined — we are booking a vendor.';
    case 'CLOSED_EXPIRED':
      return 'Not enough neighbours joined this time.';
    case 'ASSIGNED':
      return 'A vendor is scheduled. We will message you with the time.';
    case 'DELIVERED':
      return 'This job is done.';
    case 'RATED':
      return 'This job is done.';
    case 'CANCELLED':
      return 'This round was cancelled. You were not charged.';
    default: {
      // A new RoundStatus must fail the build here rather than ship a resident a
      // blank explanation line (FEAT-008 V2).
      const _exhaustive: never = round.status;
      return _exhaustive;
    }
  }
}

function MyRequestCard({ round }: { round: MyRoundDto }) {
  return (
    <Card data-testid={`my-round-${round.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{round.service.name}</CardTitle>
          <Badge data-testid="status-badge">{STATUS_LABEL[round.status]}</Badge>
        </div>
        <CardDescription>{statusDetail(round)}</CardDescription>
      </CardHeader>
      <dl className="grid gap-1 text-sm text-slate-600">
        <div className="flex justify-between">
          <dt>Your pledge</dt>
          <dd data-testid="my-units">
            {round.myUnits} {round.myUnits === 1 ? 'unit' : 'units'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Price per unit</dt>
          <dd data-testid="my-price">{formatRupees(round.currentPrice)}</dd>
        </div>
      </dl>

      {/* FEAT-009: rating lives here rather than on its own route — this card is
          already where a resident looks at a finished job (ADR-0018). */}
      {isRateable(round.status) && <RateRound round={round} />}
    </Card>
  );
}

/**
 * "My Requests" (BRIEF resident nav): every round this resident joined and where
 * it stands — including closed, cancelled and delivered ones, which
 * `GET /rounds` (OPEN-only) cannot show.
 */
export function MyRequestsPage() {
  const query = useMyRounds();
  const { data, isLoading, refetch } = query;
  // Both rules — "paused counts as failed" and "an empty array is not data" —
  // come from lib/offline.ts, the single place that owns them (CHORE-005). They
  // were inline here, which is the drift the lib exists to prevent.
  const failed = queryStalled(query);
  const hasData = hasRows(data);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
        <p className="text-sm text-slate-500">Rounds you have joined</p>
      </header>

      {isLoading && <p className="text-slate-500">Loading your requests…</p>}

      {failed && <QueryErrorState subject="requests" hasData={hasData} onRetry={() => void refetch()} />}

      {!failed && data && data.length === 0 && (
        <Card data-testid="my-requests-empty">
          <CardHeader>
            <CardTitle>You haven't joined a round yet</CardTitle>
            <CardDescription>
              Join a group buy and it will show up here with its status.
            </CardDescription>
          </CardHeader>
          <Link to="/rounds" className="text-sm font-medium text-teal-700 underline">
            See open rounds
          </Link>
        </Card>
      )}

      {data?.map((round) => <MyRequestCard key={round.id} round={round} />)}
    </main>
  );
}
