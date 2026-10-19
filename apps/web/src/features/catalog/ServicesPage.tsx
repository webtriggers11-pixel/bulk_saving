import { Link, useNavigate } from 'react-router-dom';
import { unitLabelFor } from '../../lib/units';
import type { RoundDto, ServiceDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Icon, type IconName } from '../../components/ui/icon';
import { QueryErrorState } from '../../components/QueryState';
import { hasRows, queryStalled } from '../../lib/offline';
import { Card, CardDescription, CardEyebrow, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { cn } from '../../lib/utils';
import { ApiError } from '../../lib/api';
import { formatIndicativePrice } from './formatPrice';
import { useCatalog, useServiceAsk } from './useCatalog';
import { FilterChips } from '../../components/ui/filter-chips';
import { ResultSummary } from '../../components/ui/result-summary';
import { SearchField } from '../../components/ui/search-field';
import { CATEGORY_FILTER_OPTIONS, isListedCategory } from '../../lib/categories';
import { useDebouncedSearch, useUrlFilters } from '../../lib/filters';
import { CatalogSkeleton } from './CatalogSkeleton';
import { useRounds } from '../rounds/useRounds';
import { formatRupees } from '../rounds/formatPrice';
import { formatCountdown } from '../rounds/formatCountdown';
import { formatUnits } from '../../lib/units';

/**
 * A service's glyph. The catalog carries an optional image; when it does not, this
 * picks from the one icon family by category keyword rather than falling back to an
 * emoji, so a society with no artwork still gets a designed card (FEAT-011).
 */
export function glyphFor(service: Pick<ServiceDto, 'category' | 'name'>): IconName {
  // FEAT-014 categories decide outright: their names collide with the keywords below
  // ("Car Wash" would read as cleaning, "Washing Machine" too).
  if (service.category === 'Vehicle') return 'car';
  if (service.category === 'Bulk Staples') return 'basket';
  if (service.category === 'Utilities') return /(inverter|battery|electric)/i.test(service.name) ? 'bolt' : 'water';
  const haystack = `${service.category} ${service.name}`.toLowerCase();
  if (/(ac|air|appliance|fridge|geyser)/.test(haystack)) return 'ac';
  if (/(pest|termite|cockroach)/.test(haystack)) return 'pest';
  if (/(clean|wash|bathroom|sanit)/.test(haystack)) return 'clean';
  if (/(paint|renovat|polish)/.test(haystack)) return 'paint';
  return 'service';
}

function ServiceGlyph({ service, size }: { service: ServiceDto; size: number }) {
  if (service.imageUrl) {
    return <img src={service.imageUrl} alt="" className="h-full w-full object-cover" />;
  }
  return <Icon name={glyphFor(service)} size={size} strokeWidth={1.7} />;
}

function PriceLine({ service, className }: { service: ServiceDto; className?: string }) {
  const price = formatIndicativePrice(service.indicativePrice);
  if (!price) {
    return null;
  }
  // One element, one text run. Testing Library reads an element's OWN text nodes,
  // so splitting "From ₹3,500 / room" across styled spans would make the price
  // unfindable by the sentence a resident actually sees.
  return (
    <p className={cn('num font-extrabold text-ink', className)} data-testid="service-price">
      From {price} / {unitLabelFor(service)}
    </p>
  );
}

/**
 * FEAT-021: whether this service can be booked right now. Booking means joining its open
 * round (rounds are opened by an admin, ADR-0010), so the line says which round, at what
 * price, how far along — or plainly that there is none yet.
 * `undefined` = the rounds list has not loaded: say nothing rather than guess.
 */
function RoundStatus({
  service,
  round,
  className,
}: {
  service: ServiceDto;
  round: RoundDto | null | undefined;
  className?: string;
}) {
  if (round === undefined) return null;
  if (round === null) return <AskControl service={service} className={className} />;
  // Already pledged: say so — the tap changes a pledge rather than making one (V2 P3).
  const lead =
    round.myUnits > 0
      ? `You’re in with ${formatUnits(round.myUnits, round.service)}`
      : `Group buy open · ${formatUnits(round.unitsCount, round.service)} in`;
  return (
    // One run of text that wraps across the full width (BUG-016): as dot | text | arrow
    // columns, the text got what was left between them — 75px on a phone tile.
    <p className={cn('text-meta font-bold text-brand-ink', className)} data-testid="service-round">
      <span aria-hidden="true" className="animate-pulse-ring mr-2 inline-block h-2 w-2 rounded-full bg-brand align-middle" />
      {lead} · {formatRupees(round.currentPrice)} now ·{' '}
      {/* The countdown and the arrow break as one piece — never an arrow alone on a line. */}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {formatCountdown(round.deadline)}
        <Icon name="forward" size={15} strokeWidth={2.2} className="nudge" />
      </span>
    </p>
  );
}

/**
 * FEAT-022 (ADR-0033): no round is open, so the resident can ASK for one — and see who
 * else has. Asking again takes it back. When an admin opens a round for it, everyone who
 * asked is told (SMS + push) and lands on that round.
 */
function AskControl({ service, className }: { service: ServiceDto; className?: string }) {
  const ask = useServiceAsk();
  const { askCount, askedByMe } = service.demand;
  const others = askedByMe ? askCount - 1 : askCount;
  const neighbours = (n: number) => `${n} neighbour${n === 1 ? '' : 's'}`;
  const line =
    askCount === 0
      ? 'No group buy open yet — be the first to ask'
      : askedByMe
        ? others > 0
          ? `You and ${neighbours(others)} asked`
          : 'You asked — we’ll tell you when it opens'
        : `${neighbours(askCount)} asked for this`;
  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="service-no-round">
      {/* Wraps rather than squeezes (BUG-015): on a narrow tile the button drops below. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* 9rem is the BASIS (when to wrap), not a minimum: as a min-width it spilled past
            a 117px tile on a 360px phone (BUG-015 V2 P1). */}
        <p className="min-w-0 flex-[1_1_9rem] text-micro text-ink-muted" data-testid="service-demand">
          {line}
        </p>
        <Button
          size="sm"
          variant={askedByMe ? 'secondary' : 'primary'}
          aria-pressed={askedByMe}
          disabled={ask.isPending}
          onClick={() => ask.mutate({ serviceId: service.id, asked: askedByMe })}
          data-testid={`ask-${service.slug}`}
        >
          {askedByMe ? (
            <>
              <Icon name="check" size={15} strokeWidth={2.4} />
              Asked
            </>
          ) : (
            'Ask for this'
          )}
        </Button>
      </div>
      {ask.isError && (
        <p role="alert" className="text-micro font-bold text-danger-ink">
          {ask.error instanceof ApiError && ask.error.code === 'ROUND_ALREADY_OPEN'
            ? 'A group buy for this just opened — refreshing so you can join it.'
            : 'Couldn’t send that. Please try again.'}
        </p>
      )}
    </div>
  );
}

/** The lead service: a hero card with a watermark glyph and the price as a pill. */
function ServiceHero({ service, round }: { service: ServiceDto; round?: RoundDto | null }) {
  const price = formatIndicativePrice(service.indicativePrice);
  return (
    <Card padding="none" className="col-span-2 overflow-hidden p-[22px]" data-testid="service-card">
      <span aria-hidden="true" className="pointer-events-none absolute -right-7 -top-8 text-brand/10">
        <ServiceGlyph service={service} size={165} />
      </span>
      <CardEyebrow className="relative">{service.category}</CardEyebrow>
      <CardTitle size="2xl" className="relative mt-2">{service.name}</CardTitle>
      <CardDescription className="relative mt-2 max-w-[235px]">{service.description}</CardDescription>
      <div className="relative mt-[18px] flex items-center gap-2.5">
        {price && (
          <span
            className="num inline-flex items-baseline gap-1.5 rounded-control border border-paper/75 bg-gradient-to-br from-brand-light/30 to-brand/10 px-4 py-2.5 text-[19px] font-extrabold text-brand-ink shadow-hairline"
            data-testid="service-price"
          >
            {/* One text run, for the same reason as PriceLine above. */}
            From {price} / {unitLabelFor(service)}
          </span>
        )}
      </div>
      {/* What one unit includes — the same sentence the round card shows, so a
          resident reads the scope before the price means anything. */}
      {service.unitDescription?.trim() && (
        <p
          className="relative mt-3.5 border-t border-line/10 pt-3.5 text-micro text-ink-soft"
          data-testid="service-unit-scope"
        >
          {service.unitDescription}
        </p>
      )}
      <RoundStatus service={service} round={round} className="relative mt-3.5" />
    </Card>
  );
}

/**
 * A square tile — two of these sit beside each other under the hero. Below 400px wide a
 * tile is only ~150px, so it lays out as a row instead (BUG-016): glyph beside the text,
 * the same shape as `ServiceRow`, and the list reads as one consistent column on a phone.
 */
function ServiceTile({ service, round }: { service: ServiceDto; round?: RoundDto | null }) {
  return (
    <Card padding="none" surface="solid" className="flex h-full flex-col p-[18px]" data-testid="service-card">
      <div className="mb-3.5 flex items-start gap-3.5 min-[400px]:flex-1 min-[400px]:flex-col min-[400px]:gap-0">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-control border border-paper/80 bg-gradient-to-br from-brand-light/20 to-brand/5 text-brand-ink">
          <ServiceGlyph service={service} size={22} />
        </span>
        <div className="min-w-0 flex-1 min-[400px]:mt-3.5 min-[400px]:flex min-[400px]:flex-col">
          <CardEyebrow>{service.category}</CardEyebrow>
          {/* From 400px tiles sit side by side. Title, description and scope each reserve two
              lines there, so the price lands at the same height in both tiles whatever their
              text or their footers (BUG-016 V2 P2-1 — pushing the price down only aligned it
              when both footers happened to be the same height). */}
          <h3 className="mt-1 text-[16px] font-extrabold tracking-[-0.034em] text-ink min-[400px]:line-clamp-2 min-[400px]:min-h-[2lh]">
            {service.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-micro text-ink-muted min-[400px]:min-h-[2lh]">{service.description}</p>
          {service.unitDescription?.trim() ? (
            <p
              className="mt-1.5 text-[10.5px] leading-snug text-ink-soft min-[400px]:line-clamp-2 min-[400px]:min-h-[2lh]"
              data-testid="service-unit-scope"
            >
              {service.unitDescription}
            </p>
          ) : (
            <p aria-hidden="true" className="mt-1.5 hidden text-[10.5px] leading-snug min-[400px]:block min-[400px]:min-h-[2lh]" />
          )}
          <PriceLine service={service} className="mt-2 text-[15px]" />
        </div>
      </div>
      {/* At the bottom of every tile, so two tiles side by side line their footers up. */}
      <RoundStatus service={service} round={round} className="mt-auto border-t border-line/10 pt-3.5" />
    </Card>
  );
}

/** Everything past the third service: a wide row, so the rhythm stays a bento. */
function ServiceRow({ service, round }: { service: ServiceDto; round?: RoundDto | null }) {
  return (
    <Card padding="none"
      surface="solid"
      className="col-span-2 flex flex-col p-[18px]"
      data-testid="service-card"
    >
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-control border border-paper/80 bg-gradient-to-br from-brand-light/20 to-brand/5 text-brand-ink">
          <ServiceGlyph service={service} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <CardEyebrow>{service.category}</CardEyebrow>
          <h3 className="mt-1 text-[16.5px] font-extrabold tracking-[-0.034em] text-ink">{service.name}</h3>
          {/* `service-unit-scope` means "what one unit includes" (ADR-0019) and
              nothing else — a service with no unitDescription shows its description
              instead, under no testid, rather than widening what the id means. */}
          {service.unitDescription?.trim() ? (
            <p className="mt-1 text-micro text-ink-muted" data-testid="service-unit-scope">
              {service.unitDescription}
            </p>
          ) : (
            <p className="mt-1 text-micro text-ink-muted">{service.description}</p>
          )}
          {/* BUG-015: under the text, not a fixed column beside it — "From ₹3,500 / flat"
              on the right left the name and scope 33–77px wide on a 360px phone. */}
          <PriceLine service={service} className="mt-2 text-[15px]" />
        </div>
      </div>
      {/* BUG-015: the round / ask line gets the card full width as a footer. Inside the
          text column it was squeezed between the glyph and the price, one word a line. */}
      <RoundStatus service={service} round={round} className="mt-3.5 border-t border-line/10 pt-3.5" />
    </Card>
  );
}

/**
 * Resident catalog screen (FEAT-002). Lists the caller's society's available
 * services as mobile-first cards, with explicit loading, error and empty states.
 * Data comes from `GET /catalog` via TanStack Query; ProtectedRoute guards it.
 *
 * FEAT-011 gives the list a bento rhythm — lead card, two tiles, then rows — rather
 * than one repeated card shape. The order and the data are untouched.
 *
 * FEAT-015: search and category chips, filtered on the server within the resident's own
 * society, with the filters in the URL.
 */
const CATALOG_FILTER_KEYS = ['q', 'category'] as const;
const CATALOG_FILTER_VALIDATORS = { category: isListedCategory };

export function ServicesPage() {
  const navigate = useNavigate();
  const { filters, setFilters, clear, activeCount, generation } = useUrlFilters(CATALOG_FILTER_KEYS, CATALOG_FILTER_VALIDATORS);
  const [search, setSearch] = useDebouncedSearch(filters.q, (q) => setFilters({ q }), generation);
  const query = useCatalog({ q: filters.q, category: filters.category });
  // FEAT-021: the open rounds (already fetched and polled for the rounds screen), keyed by
  // service slug. The soonest-closing one wins if a service ever has two.
  const rounds = useRounds();
  const openBySlug = new Map<string, RoundDto>();
  for (const round of [...(rounds.data ?? [])].sort((a, b) => a.deadline.localeCompare(b.deadline))) {
    if (!openBySlug.has(round.service.slug)) openBySlug.set(round.service.slug, round);
  }
  const openRoundFor = (service: ServiceDto): RoundDto | null | undefined =>
    rounds.data ? (openBySlug.get(service.slug) ?? null) : undefined;
  const { data, isLoading, isPlaceholderData, refetch } = query;
  const failed = queryStalled(query);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-[22px]">
      <PageHeader
        collapsible
        title="Services"
        subtitle="Available in your society"
        action={
          <Button variant="secondary" size="icon" aria-label="Back" onClick={() => navigate('/')}>
            <Icon name="back" size={20} strokeWidth={2.1} />
          </Button>
        }
      />

      <div className="flex flex-col gap-3" role="search" aria-label="Find a service">
        <SearchField
          label="Search services"
          placeholder="Try “tank”, “AC” or “rice”"
          value={search}
          onChange={setSearch}
          maxLength={80}
        />
        <FilterChips
          label="Category"
          options={CATEGORY_FILTER_OPTIONS}
          value={filters.category ?? ''}
          onChange={(category) => setFilters({ category: category || undefined })}
        />
        {activeCount > 0 && (
          <ResultSummary
            count={data?.length}
            noun={['service', 'services']}
            activeCount={activeCount}
            onClear={clear}
            busy={isPlaceholderData}
          />
        )}
      </div>

      {isLoading && <CatalogSkeleton />}

      {failed && <QueryErrorState subject="services" hasData={hasRows(data)} onRetry={() => void refetch()} />}

      {data && data.length === 0 && !failed && activeCount > 0 && (
        <EmptyState
          icon="search"
          title="Nothing matches that"
          description="Try another word, or a different category."
          data-testid="catalog-no-match"
          action={
            <Button variant="secondary" onClick={clear}>
              Show all services
            </Button>
          }
        />
      )}

      {data && data.length === 0 && !failed && activeCount === 0 && (
        <EmptyState
          icon="clean"
          title="No services yet"
          description="Your society doesn't have any services available yet. Check back soon."
          data-testid="catalog-empty"
        />
      )}

      {data && data.length > 0 && (
        <section aria-label="Available services" className="results" aria-busy={isPlaceholderData}>
          <ul className="stagger grid grid-cols-2 gap-3.5">
            {data.map((service, index) => {
              const round = openRoundFor(service);
              const card =
                index === 0 ? (
                  <ServiceHero service={service} round={round} />
                ) : index <= 2 ? (
                  <ServiceTile service={service} round={round} />
                ) : (
                  <ServiceRow service={service} round={round} />
                );
              return (
                <li
                  key={service.id}
                  // BUG-016: tiles go full width below 400px (see ServiceTile).
                  className={index === 1 || index === 2 ? 'col-span-2 min-[400px]:col-span-1' : 'col-span-2'}
                >
                  {/* FEAT-021: a bookable service is one tap from its pledge sheet. */}
                  {round ? (
                    <Link
                      to={`/rounds?join=${encodeURIComponent(round.id)}`}
                      // No aria-label: the card IS the name — service, price, units and
                      // countdown are what a screen-reader user decides on too (V2 P3).
                      className="block h-full rounded-card focus-visible:shadow-focus focus-visible:outline-none"
                      data-testid={`book-${service.slug}`}
                    >
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
