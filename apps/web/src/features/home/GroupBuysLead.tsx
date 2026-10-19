import { useNavigate } from 'react-router-dom';
import type { RoundDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Icon } from '../../components/ui/icon';
import { unitLabelFor } from '../../lib/units';
import { formatCountdown } from '../rounds/formatCountdown';
import { formatRupees } from '../rounds/formatPrice';
import { useRounds } from '../rounds/useRounds';

/** How many open rounds Home shows before pointing at the Group buys tab. */
const ROWS = 3;

/** Soonest-closing first: the round that needs a decision now sits at the top. */
function soonest(rounds: RoundDto[]): RoundDto[] {
  return [...rounds].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
}

/**
 * Home's lead card (FEAT-023): the product's core loop, first. The same `['rounds']`
 * query the Group buys tab polls — so the counts here are the counts there — with up to
 * three rounds as rows that deep-link into the pledge sheet (`/rounds?join=<id>`, FEAT-021).
 *
 * The rounds query failing must not blank Home: the card then shows its title and the
 * way in, without numbers or rows. Loading shows the same, with a quiet line.
 */
export function GroupBuysLead() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useRounds();
  const rounds = data ?? [];
  const open = rounds.length;
  const joined = rounds.filter((round) => round.myUnits > 0).length;
  const known = data !== undefined;
  const empty = known && open === 0;

  return (
    <Card
      padding="none"
      surface="accent"
      className="sheen col-span-2 overflow-hidden p-[22px]"
      data-testid="group-buys-lead"
    >
      <span
        aria-hidden="true"
        className="animate-glide absolute -right-8 -top-12 h-48 w-48 rounded-full bg-on-fill/40 blur-3xl"
      />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-11 -right-4 text-on-fill opacity-10">
        <Icon name="users" size={170} strokeWidth={1.1} />
      </span>

      <div className="relative flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-on-fill/40 bg-on-fill/20 text-on-fill">
          <Icon name="users" size={22} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-eyebrow uppercase text-on-fill">Group buys</p>
          <h2 className="mt-1.5 text-headline font-extrabold leading-tight text-on-fill" data-testid="group-buys-title">
            {empty ? 'Nothing open right now' : known ? `${open} open in your society` : 'Open in your society'}
          </h2>
          <p className="mt-1.5 text-meta font-semibold text-on-fill" data-testid="group-buys-line">
            {isLoading
              ? 'Checking what is open…'
              : isError && !known
                ? 'Could not check just now — open the tab to retry.'
                : empty
                  ? 'Ask for a service and we will open a round for it.'
                  : joined > 0
                    ? `You're in ${joined} of them.`
                    : 'More neighbours joining means a lower price for everyone.'}
          </p>
        </div>
      </div>

      {open > 0 && (
        <ul className="relative mt-4 flex flex-col gap-2" data-testid="group-buys-rows">
          {soonest(rounds)
            .slice(0, ROWS)
            .map((round) => (
              <li key={round.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/rounds?join=${encodeURIComponent(round.id)}`)}
                  className="press t flex min-h-touch w-full items-center gap-3 rounded-inset border border-on-fill/25 bg-on-fill/15 px-3.5 py-2.5 text-left text-on-fill focus-visible:shadow-focus focus-visible:outline-none"
                  data-testid={`group-buys-row-${round.id}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-extrabold">{round.service.name}</span>
                    <span className="mt-0.5 block text-micro font-semibold text-on-fill">
                      {formatCountdown(round.deadline)}
                      {round.myUnits > 0 && (
                        <>
                          {' · '}
                          <span data-testid={`group-buys-in-${round.id}`}>You&apos;re in</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="num shrink-0 whitespace-nowrap text-body font-extrabold">
                    {formatRupees(round.currentPrice)}
                    <span className="text-micro font-semibold text-on-fill"> / {unitLabelFor(round.service)}</span>
                  </span>
                  <Icon name="forward" size={16} strokeWidth={2.3} className="nudge shrink-0" />
                </button>
              </li>
            ))}
        </ul>
      )}

      <div className="relative mt-4 flex flex-wrap items-center gap-2.5">
        {empty ? (
          <Button variant="secondary" tone="onAccent" size="sm" onClick={() => navigate('/services')}>
            Ask for a service
            <Icon name="forward" size={15} strokeWidth={2.3} className="nudge" />
          </Button>
        ) : (
          <Button variant="secondary" tone="onAccent" size="sm" onClick={() => navigate('/rounds')}>
            {open > ROWS ? `See all ${open} group buys` : 'See group buys'}
            <Icon name="forward" size={15} strokeWidth={2.3} className="nudge" />
          </Button>
        )}
      </div>
    </Card>
  );
}
