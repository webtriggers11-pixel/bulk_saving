import { Link } from 'react-router-dom';
import type { MyRoundDto, RoundStatus } from '@bulk/shared';
import { QueryErrorState } from '../../components/QueryState';
import { Card, CardDescription, CardTitle } from '../../components/ui/card';
import { Badge, type BadgeTone } from '../../components/ui/badge';
import { Icon, type IconName } from '../../components/ui/icon';
import { formatCountdown } from '../rounds/formatCountdown';
import { formatRupees } from '../rounds/formatPrice';
import { formatUnits, unitLabelFor } from '../../lib/units';
import { useMyRounds } from '../rounds/useRounds';
import { hasRows, queryStalled } from '../../lib/offline';
import { RateRound, isRateable } from '../rating/RateRound';
import { RequestsSkeleton } from './RequestsSkeleton';

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

/**
 * How each state reads at a glance (FEAT-011): the tone of its pill, the glyph on
 * it, and how far along the four-stop journey — joined → filled → booked → done —
 * the round has come. Nothing new is stated; this is the `status` the card already
 * shows, drawn as a position instead of only a word.
 */
const STATUS_STYLE: Record<RoundStatus, { tone: BadgeTone; icon: IconName; step: number }> = {
  OPEN: { tone: 'teal', icon: 'clock', step: 1 },
  CLOSED_MET: { tone: 'teal', icon: 'check', step: 2 },
  CLOSED_EXPIRED: { tone: 'slate', icon: 'info', step: 0 },
  ASSIGNED: { tone: 'blue', icon: 'check', step: 3 },
  DELIVERED: { tone: 'green', icon: 'check', step: 4 },
  RATED: { tone: 'green', icon: 'check', step: 4 },
  CANCELLED: { tone: 'red', icon: 'close', step: 0 },
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

/** The four stops of a round, drawn from the status this card already shows. */
function JourneyTrack({ step }: { step: number }) {
  return (
    <div aria-hidden="true" className="mt-3.5 flex gap-1.5">
      {[1, 2, 3, 4].map((stop) => (
        <span
          key={stop}
          className="h-[5px] flex-1 overflow-hidden rounded-full bg-shade/15 shadow-hairline"
        >
          {stop <= step && (
            <span
              className="bar-fill block h-full w-full rounded-full bg-gradient-to-r from-brand-deep to-brand"
              style={{ animationDelay: `${200 + stop * 90}ms` }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

/** One fact of the pledge, as a tile — two of these sit side by side. */
function Fact({ term, value, testId }: { term: string; value: string; testId: string }) {
  return (
    <div className="surface-inset min-w-0 flex-1 rounded-inset px-3.5 py-3">
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">{term}</dt>
      <dd className="num mt-1.5 text-[15.5px] font-extrabold text-ink" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function MyRequestCard({ round, last, lead }: { round: MyRoundDto; last: boolean; lead: boolean }) {
  const style = STATUS_STYLE[round.status];
  return (
    <li className="flex items-stretch gap-3.5">
      {/* The rail: where this round sits in the list, and how far it has come. */}
      <div aria-hidden="true" className="flex w-4 shrink-0 flex-col items-center pt-6">
        <span
          className={[
            'h-3 w-3 rounded-full ring-4',
            style.step >= 4
              ? 'bg-success-ink ring-success-ink/15'
              : style.step === 3
                ? 'bg-info-ink ring-info-ink/15'
                : style.step === 0
                  ? 'bg-ink-soft ring-ink-soft/15'
                  : 'bg-brand ring-brand/15',
          ].join(' ')}
        />
        {!last && <span className="mt-1.5 w-0.5 flex-1 rounded-full bg-shade/10" />}
      </div>

      <Card
        // Glass is blur, and blur is per-surface cost: only the LEAD open round gets
        // it, or a resident in eight open rounds scrolls eight blurred layers
        // (V2 round 2, P2-3).
        surface={lead ? 'glass' : 'solid'}
        className="min-w-0 flex-1 p-[19px]"
        data-testid={`my-round-${round.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-[18px]">{round.service.name}</CardTitle>
          <Badge
            tone={style.tone}
            icon={<Icon name={style.icon} size={13} strokeWidth={2.2} />}
            data-testid="status-badge"
          >
            {STATUS_LABEL[round.status]}
          </Badge>
        </div>
        <CardDescription className="mt-2 text-meta">{statusDetail(round)}</CardDescription>
        <JourneyTrack step={style.step} />

        <dl className="mt-4 flex gap-2.5">
          <Fact term="Your pledge" value={formatUnits(round.myUnits, round.service)} testId="my-units" />
          <Fact
            term={`Price per ${unitLabelFor(round.service)}`}
            value={formatRupees(round.currentPrice)}
            testId="my-price"
          />
        </dl>

        {/* FEAT-009: rating lives here rather than on its own route — this card is
            already where a resident looks at a finished job (ADR-0018). */}
        {isRateable(round.status) && <RateRound round={round} />}
      </Card>
    </li>
  );
}

/**
 * "My Requests" (BRIEF resident nav): every round this resident joined and where
 * it stands — including closed, cancelled and delivered ones, which
 * `GET /rounds` (OPEN-only) cannot show.
 *
 * FEAT-011 draws it as a status timeline: a rail on the left carries each round's
 * state as a colour, and each card shows the same state as a position on its
 * four-stop journey.
 */
export function MyRequestsPage() {
  const query = useMyRounds();
  const { data, isLoading, refetch } = query;
  // Both rules — "paused counts as failed" and "an empty array is not data" —
  // come from lib/offline.ts, the single place that owns them (CHORE-005). They
  // were inline here, which is the drift the lib exists to prevent.
  const failed = queryStalled(query);
  const hasData = hasRows(data);
  // Computed once, not per row: only the first OPEN round gets the glass surface,
  // so blur does not scale with how many rounds a resident has joined.
  const leadOpenIndex = data?.findIndex((round) => round.status === 'OPEN') ?? -1;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-[22px]">
      <header className="animate-rise">
        <h1 className="text-display font-extrabold text-ink">My Requests</h1>
        <p className="mt-1 text-caption text-ink-muted">Rounds you have joined</p>
      </header>

      {isLoading && <RequestsSkeleton />}

      {failed && <QueryErrorState subject="requests" hasData={hasData} onRetry={() => void refetch()} />}

      {!failed && data && data.length === 0 && (
        <Card className="p-7 text-center" data-testid="my-requests-empty">
          <span className="animate-breathe mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-inset border border-white/80 bg-gradient-to-br from-brand-light/20 to-brand/5 text-brand-ink shadow-lift">
            <Icon name="requests" size={26} strokeWidth={1.7} />
          </span>
          <CardTitle className="mt-4">You haven&apos;t joined a round yet</CardTitle>
          <CardDescription className="mt-2">
            Join a group buy and it will show up here with its status.
          </CardDescription>
          <Link
            to="/rounds"
            className="mt-4 inline-flex items-center gap-2 rounded-control border border-brand/30 paint-tint px-4 py-2.5 text-meta font-extrabold text-brand-ink no-underline t press"
          >
            See open rounds
            <Icon name="forward" size={16} strokeWidth={2.2} />
          </Link>
        </Card>
      )}

      {data && data.length > 0 && (
        <ol className="stagger flex flex-col gap-3">
          {data.map((round, index) => (
            <MyRequestCard
              key={round.id}
              round={round}
              last={index === data.length - 1}
              lead={index === leadOpenIndex}
            />
          ))}
        </ol>
      )}
    </main>
  );
}
