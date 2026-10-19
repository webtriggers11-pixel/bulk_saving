import { Link } from 'react-router-dom';
import type { MyRoundDto, RoundStatus } from '@bulk/shared';
import { QueryErrorState } from '../../components/QueryState';
import { Card, CardDescription, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Fact } from '../../components/ui/fact';
import { PageHeader } from '../../components/ui/page-header';
import { Badge, type BadgeTone } from '../../components/ui/badge';
import { Icon, type IconName } from '../../components/ui/icon';
import { formatCountdown } from '../rounds/formatCountdown';
import { formatRupees } from '../rounds/formatPrice';
import { formatUnits, unitLabelFor } from '../../lib/units';
import { useMyRounds } from '../rounds/useRounds';
import { hasRows, queryStalled } from '../../lib/offline';
import { RateRound, isRateable } from '../rating/RateRound';
import { RequestsSkeleton } from './RequestsSkeleton';
import { ShowMore } from '../../components/ui/show-more';

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
          className="h-[5px] flex-1 overflow-hidden rounded-full bg-line/15 shadow-hairline"
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
        {!last && <span className="mt-1.5 w-0.5 flex-1 rounded-full bg-line/10" />}
      </div>

      <Card padding="none"
        // Glass is blur, and blur is per-surface cost: only the LEAD open round gets
        // it, or a resident in eight open rounds scrolls eight blurred layers
        // (V2 round 2, P2-3).
        surface={lead ? 'glass' : 'solid'}
        className="min-w-0 flex-1 p-[18px]"
        data-testid={`my-round-${round.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <CardTitle size="sm" >{round.service.name}</CardTitle>
          <Badge
            tone={style.tone}
            icon={<Icon name={style.icon} size={13} strokeWidth={2.2} />}
            data-testid="status-badge"
          >
            {STATUS_LABEL[round.status]}
          </Badge>
        </div>
        <CardDescription size="meta" className="mt-2">{statusDetail(round)}</CardDescription>
        <JourneyTrack step={style.step} />

        {/* BUG-015: a grid that wraps — three facts in one row pushed the card 12px past a
            360px screen and squeezed "Final price per flat" to 45px. */}
        <dl
          className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2.5"
          data-testid="my-facts"
        >
          <Fact term="Your pledge" value={formatUnits(round.myUnits, round.service)} testId="my-units" />
          {/* BUG-010: once the admin has negotiated a price, that is what the resident
              pays — the tier price the round reached while open is history. */}
          <Fact
            term={`${round.finalPrice !== null ? 'Final price' : 'Price'} per ${unitLabelFor(round.service)}`}
            value={formatRupees(round.finalPrice ?? round.currentPrice)}
            testId="my-price"
          />
          {round.finalPrice !== null && (
            // The odd third fact takes the whole row rather than sitting at half width. On the
            // Fact itself, not as an `&>*` variant on the grid: the class gate cannot read
            // those, so a typo there would pass unseen (BUG-015 V2 r2 P3).
            <Fact term="You owe" value={formatRupees(round.finalPrice * round.myUnits)} testId="my-total" className="col-span-full" />
          )}
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
      <PageHeader title="My Requests" subtitle="Rounds you have joined" collapsible />

      {isLoading && <RequestsSkeleton />}

      {failed && <QueryErrorState subject="requests" hasData={hasData} onRetry={() => void refetch()} />}

      {!failed && data && data.length === 0 && (
        <EmptyState
          icon="requests"
          title="You haven't joined a round yet"
          description="Join a group buy and it will show up here with its status."
          data-testid="my-requests-empty"
          action={
            <Link
              to="/rounds"
              className="t press inline-flex items-center gap-2 rounded-control border border-brand/30 paint-tint px-4 py-2.5 text-meta font-extrabold text-brand-ink no-underline"
            >
              See open rounds
              <Icon name="forward" size={16} strokeWidth={2.2} />
            </Link>
          }
        />
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
          <ShowMore hasMore={query.hasMore} loaded={data.length} total={query.total} busy={query.loadingMore} onMore={query.loadMore} noun={['request', 'requests']} />
        </ol>
      )}
    </main>
  );
}
