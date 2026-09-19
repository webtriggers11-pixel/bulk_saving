import { useNavigate } from 'react-router-dom';
import { unitLabelFor } from '../../lib/units';
import type { ServiceDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Icon, type IconName } from '../../components/ui/icon';
import { QueryErrorState } from '../../components/QueryState';
import { hasRows, queryStalled } from '../../lib/offline';
import { Card, CardDescription, CardEyebrow, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { PageHeader } from '../../components/ui/page-header';
import { cn } from '../../lib/utils';
import { formatIndicativePrice } from './formatPrice';
import { useCatalog } from './useCatalog';
import { CatalogSkeleton } from './CatalogSkeleton';

/**
 * A service's glyph. The catalog carries an optional image; when it does not, this
 * picks from the one icon family by category keyword rather than falling back to an
 * emoji, so a society with no artwork still gets a designed card (FEAT-011).
 */
function glyphFor(service: ServiceDto): IconName {
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

/** The lead service: a hero card with a watermark glyph and the price as a pill. */
function ServiceHero({ service }: { service: ServiceDto }) {
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
            className="num inline-flex items-baseline gap-1.5 rounded-control border border-white/75 bg-gradient-to-br from-brand-light/30 to-brand/10 px-4 py-2.5 text-[19px] font-extrabold text-brand-ink shadow-hairline"
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
          className="relative mt-3.5 border-t border-shade/10 pt-3.5 text-micro text-ink-soft"
          data-testid="service-unit-scope"
        >
          {service.unitDescription}
        </p>
      )}
    </Card>
  );
}

/** A square tile — two of these sit beside each other under the hero. */
function ServiceTile({ service }: { service: ServiceDto }) {
  return (
    <Card padding="none" surface="solid" className="flex h-full flex-col p-[17px]" data-testid="service-card">
      <span className="flex h-[46px] w-[46px] items-center justify-center overflow-hidden rounded-control border border-white/80 bg-gradient-to-br from-brand-light/20 to-brand/5 text-brand-ink">
        <ServiceGlyph service={service} size={22} />
      </span>
      <CardEyebrow className="mt-3.5">{service.category}</CardEyebrow>
      <h3 className="mt-1.5 text-[16px] font-extrabold tracking-[-0.034em] text-ink">{service.name}</h3>
      <p className="mt-1.5 line-clamp-2 text-micro text-ink-muted">{service.description}</p>
      <PriceLine service={service} className="mt-auto pt-3 text-[15px]" />
      {service.unitDescription?.trim() && (
        <p className="mt-1.5 text-[10.5px] leading-snug text-ink-soft" data-testid="service-unit-scope">
          {service.unitDescription}
        </p>
      )}
    </Card>
  );
}

/** Everything past the third service: a wide row, so the rhythm stays a bento. */
function ServiceRow({ service }: { service: ServiceDto }) {
  return (
    <Card padding="none"
      surface="solid"
      className="col-span-2 flex items-center gap-3.5 p-[17px]"
      data-testid="service-card"
    >
      <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-inset border border-white/80 bg-gradient-to-br from-brand-light/20 to-brand/5 text-brand-ink">
        <ServiceGlyph service={service} size={25} />
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
      </div>
      <PriceLine service={service} className="shrink-0 text-right text-[16px]" />
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
 */
export function ServicesPage() {
  const navigate = useNavigate();
  const query = useCatalog();
  const { data, isLoading, refetch } = query;
  const failed = queryStalled(query);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-[22px]">
      <PageHeader
        title="Services"
        subtitle="Available in your society"
        action={
          <Button variant="secondary" size="icon" aria-label="Back" onClick={() => navigate('/')}>
            <Icon name="back" size={20} strokeWidth={2.1} />
          </Button>
        }
      />

      {isLoading && <CatalogSkeleton />}

      {failed && <QueryErrorState subject="services" hasData={hasRows(data)} onRetry={() => void refetch()} />}

      {data && data.length === 0 && !failed && (
        <EmptyState
          icon="clean"
          title="No services yet"
          description="Your society doesn't have any services available yet. Check back soon."
          data-testid="catalog-empty"
        />
      )}

      {data && data.length > 0 && (
        <section aria-label="Available services">
          <ul className="stagger grid grid-cols-2 gap-3.5">
            {data.map((service, index) => (
              <li key={service.id} className={index === 1 || index === 2 ? '' : 'col-span-2'}>
                {index === 0 ? (
                  <ServiceHero service={service} />
                ) : index <= 2 ? (
                  <ServiceTile service={service} />
                ) : (
                  <ServiceRow service={service} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
