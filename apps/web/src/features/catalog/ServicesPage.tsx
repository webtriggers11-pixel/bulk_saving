import { useNavigate } from 'react-router-dom';
import type { ServiceDto } from '@bulk/shared';
import { Button } from '../../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { formatIndicativePrice } from './formatPrice';
import { useCatalog } from './useCatalog';

/** A single service card (name, category, indicative price, image/icon). */
function ServiceCard({ service }: { service: ServiceDto }) {
  const price = formatIndicativePrice(service.indicativePrice);
  return (
    <Card className="flex gap-4 p-4" data-testid="service-card">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-teal-50 text-2xl">
        {service.imageUrl ? (
          <img src={service.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">🛠️</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          {service.category}
        </span>
        <h3 className="truncate text-base font-bold text-slate-900">{service.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{service.description}</p>
        {price && (
          <p className="mt-2 text-sm font-semibold text-slate-900" data-testid="service-price">
            From {price}
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * Resident catalog screen (FEAT-002). Lists the caller's society's available
 * services as mobile-first cards, with explicit loading, error and empty states.
 * Data comes from `GET /catalog` via TanStack Query; ProtectedRoute guards it.
 */
export function ServicesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useCatalog();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-slate-50 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Services</h1>
          <p className="text-sm text-slate-500">Available in your society</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>
          Back
        </Button>
      </header>

      {isLoading && <p className="text-slate-500">Loading services…</p>}

      {isError && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-red-600">We couldn't load the services. Please try again.</p>
          <Button variant="primary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {data && data.length === 0 && (
        <Card data-testid="catalog-empty">
          <CardHeader>
            <CardTitle>No services yet</CardTitle>
            <CardDescription>
              Your society doesn't have any services available yet. Check back soon.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {data && data.length > 0 && (
        <section className="flex flex-col gap-4" aria-label="Available services">
          {data.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </section>
      )}
    </main>
  );
}
