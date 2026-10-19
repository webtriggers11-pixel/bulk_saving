import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe } from '../auth/auth.api';
import { useAuthStore } from '../auth/auth.store';
import { Button } from '../../components/ui/button';
import { SchemeToggle } from '../../components/ui/scheme-toggle';
import { Icon } from '../../components/ui/icon';
import { QueryErrorState } from '../../components/QueryState';
import { queryStalled } from '../../lib/offline';
import { Card, CardEyebrow, CardTitle } from '../../components/ui/card';
import { Monogram } from '../../components/ui/monogram';
import { HomeSkeleton } from './HomeSkeleton';

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  // Same source as AdminRoute (the session's resident) so the link and the guard agree.
  const isSuperAdmin = useAuthStore((state) => state.resident?.role === 'SUPER_ADMIN');

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
  });
  const { data, isLoading, refetch } = meQuery;
  const failed = queryStalled(meQuery);

  function handleLogout() {
    logout();
    queryClient.clear();
    navigate('/onboard', { replace: true });
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-[22px]">
      <header className="animate-rise flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="animate-breathe flex h-[38px] w-[38px] items-center justify-center rounded-chip paint-mono text-on-fill shadow-accent">
            <Icon name="bolt" size={20} strokeWidth={1.9} />
          </span>
          <h1 className="text-headline font-extrabold text-ink">Bulk&nbsp;Saving</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* FEAT-016: the night switch — the new scheme grows from this button. */}
          <SchemeToggle />
          <Button variant="secondary" size="icon" aria-label="Log out" onClick={handleLogout}>
            <Icon name="logout" size={19} strokeWidth={2} />
          </Button>
        </div>
      </header>

      {isLoading && <HomeSkeleton />}
      {failed && <QueryErrorState subject="profile" hasData={data !== undefined} onRetry={() => void refetch()} />}

      {data && (
        // The bento: one wide identity card, one wide accent action, two squares.
        // Emphasis comes from mixing surfaces, never from a new layout per card.
        <div className="stagger grid grid-cols-2 gap-3.5">
          <Card padding="none" className="col-span-2 flex items-center gap-4 overflow-hidden p-[22px]">
            <span
              aria-hidden="true"
              className="card-wash pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-mesh-1/40 blur-2xl"
            />
            <Monogram name={data.resident.name} />
            <div className="relative min-w-0 flex-1">
              <CardEyebrow>Signed in as</CardEyebrow>
              <CardTitle size="xl" className="animate-blur-in mt-2">
                {data.resident.name ?? 'Resident'}
              </CardTitle>
              <p
                className="num mt-2 inline-flex items-center gap-1.5 text-meta font-bold text-ink-muted"
                data-testid="resident-phone"
              >
                <Icon name="phone" size={14} strokeWidth={2} />
                {data.resident.phone}
              </p>
            </div>
          </Card>

          <Card padding="none"
            surface="accent"
            className="sheen col-span-2 flex items-center gap-4 overflow-hidden p-6"
          >
            <span
              aria-hidden="true"
              className="animate-glide absolute -right-8 -top-12 h-48 w-48 rounded-full bg-on-fill/40 blur-3xl"
            />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-11 -right-4 text-on-fill opacity-10">
              <Icon name="services" size={170} strokeWidth={1.1} />
            </span>
            <span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-inset border border-on-fill/40 bg-on-fill/20 text-on-fill">
              <Icon name="services" size={25} strokeWidth={1.8} />
            </span>
            <div className="relative min-w-0 flex-1">
              <p className="text-eyebrow uppercase text-on-fill">Explore</p>
              <h2 className="mt-1.5 text-headline font-extrabold leading-tight text-on-fill">
                Services in
                <br />
                your society
              </h2>
              <Button
                variant="secondary"
                tone="onAccent"
                size="sm"
                className="mt-3"
                onClick={() => navigate('/services')}
              >
                Browse services
                <Icon name="forward" size={15} strokeWidth={2.3} className="nudge" />
              </Button>
            </div>
          </Card>

          <Card padding="none" surface="tint" className="flex min-h-[168px] flex-col p-[19px]">
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-control border border-paper/90 bg-gradient-to-br from-paper/95 to-paper/55 text-brand-ink shadow-lift">
              <Icon name="building" size={22} strokeWidth={1.8} />
            </span>
            <CardEyebrow className="mt-auto pt-4">Your society</CardEyebrow>
            <CardTitle size="md" className="mt-2 leading-[1.12]" data-testid="society-name">
              {data.society.name}
            </CardTitle>
            <p className="mt-1 text-meta text-ink-muted" data-testid="society-city">
              {data.society.city}
            </p>
          </Card>

          <Card padding="none" className="flex min-h-[168px] flex-col p-[19px]">
            <span className="flex h-[46px] w-[46px] items-center justify-center rounded-control border border-paper/85 bg-gradient-to-br from-brand-light/25 to-brand/5 text-brand-ink">
              <Icon name="users" size={22} strokeWidth={1.8} />
            </span>
            <button
              type="button"
              aria-label="Group buys"
              onClick={() => navigate('/rounds')}
              className="mt-auto min-h-touch rounded-chip pt-4 text-left t press focus-visible:outline-none focus-visible:shadow-focus"
            >
              <span className="block text-title font-extrabold tracking-[-0.038em] text-ink">
                Group buys
              </span>
              <span className="mt-1.5 flex items-center gap-1.5 text-meta font-semibold text-ink-muted">
                Open rounds
                <Icon name="forward" size={15} strokeWidth={2.3} className="text-brand-ink" />
              </span>
            </button>
          </Card>

          {isSuperAdmin && (
            // Solid, not glass: a super-admin would otherwise carry a fourth
            // blurred surface on this screen (V2 round 2, P2-3).
            <Card padding="none" surface="solid" className="col-span-2 flex items-center gap-4 p-[19px]">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-control border border-paper/85 bg-gradient-to-br from-brand-light/25 to-brand/5 text-brand-ink">
                <Icon name="check" size={22} strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <CardEyebrow>Super-admin</CardEyebrow>
                <CardTitle size="md" className="mt-1.5">Manage rounds and vendors</CardTitle>
              </div>
              <Button size="sm" onClick={() => navigate('/admin')}>
                Admin dashboard
              </Button>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}

