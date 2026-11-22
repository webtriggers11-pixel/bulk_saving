import { Link } from 'react-router-dom';
import type { AdminOverviewDto } from '@bulk/shared';
import { Card, CardHeader, CardTitle } from '../../components/ui/card';
import { DataRows, RowSurface } from '../../components/ui/data-rows';
import { Icon, type IconName } from '../../components/ui/icon';
import { Notice } from '../../components/ui/notice';
import { Skeleton, SkeletonScreen } from '../../components/ui/skeleton';
import { StatCard } from '../../components/ui/stat';
import { errorMessage, societyLabel } from './adminFormat';
import { spacedCode } from './invitation';
import { useAdminOverview } from './useAdmin';

/** A link that looks like a secondary button: the dashboard's quick actions are navigation. */
const ACTION_LINK =
  'paint-glass inline-flex h-11 items-center gap-2 rounded-control border border-paper/70 px-4 text-meta font-bold text-ink no-underline shadow-control focus-visible:shadow-focus focus-visible:outline-none';

const QUICK_ACTIONS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/admin/societies', label: 'Onboard a society', icon: 'building' },
  { to: '/admin/rounds/new', label: 'New round', icon: 'plus' },
  { to: '/admin/vendors', label: 'Add a vendor', icon: 'users' },
  { to: '/admin/users', label: 'Manage users', icon: 'profile' },
];

function Stats({ data }: { data: AdminOverviewDto }) {
  const tiles: Array<{ label: string; value: number; to: string; icon: IconName; testId: string }> = [
    { label: 'Societies', value: data.societies, to: '/admin/societies', icon: 'building', testId: 'overview-societies' },
    { label: 'Users', value: data.users, to: '/admin/users', icon: 'profile', testId: 'overview-users' },
    { label: 'Admins', value: data.admins, to: '/admin/users?role=SUPER_ADMIN', icon: 'bolt', testId: 'overview-admins' },
    { label: 'Open rounds', value: data.openRounds, to: '/admin/rounds?status=OPEN', icon: 'clock', testId: 'overview-open-rounds' },
  ];
  return (
    <section aria-label="Platform" className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile, index) => (
        <StatCard
          key={tile.label}
          label={tile.label}
          value={String(tile.value)}
          icon={tile.icon}
          emphasis={index === 0 ? 'lead' : 'normal'}
          data-testid={tile.testId}
          action={
            // On the lead (dark) tile the brand ink disappears into the fill; use the on-fill ink there.
            <Link
              to={tile.to}
              className={index === 0 ? 'text-meta font-bold text-on-fill underline' : 'text-meta font-bold text-brand-ink underline'}
              aria-label={`Open ${tile.label}`}
            >
              Open
            </Link>
          }
        />
      ))}
    </section>
  );
}

function Recent({ data }: { data: AdminOverviewDto }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card data-testid="recent-societies">
        <CardHeader>
          <CardTitle>Newest societies</CardTitle>
        </CardHeader>
        {data.recentSocieties.length === 0 ? (
          <p className="text-meta text-ink-muted">None yet. Onboard the first one.</p>
        ) : (
          <DataRows>
            {data.recentSocieties.map((s) => (
              <RowSurface key={s.id}>
                <Link to={`/admin/societies/${s.id}`} className="flex w-full items-center gap-3 no-underline">
                  <span className="flex flex-1 flex-col">
                    <span className="text-body font-extrabold text-ink">{s.name}</span>
                    <span className="text-meta text-ink-muted">
                      {s.city} · {s.residentCount} {s.residentCount === 1 ? 'resident' : 'residents'}
                    </span>
                  </span>
                  <span className="num text-meta font-bold tracking-[0.12em] text-ink">{spacedCode(s.inviteCode)}</span>
                </Link>
              </RowSurface>
            ))}
          </DataRows>
        )}
      </Card>
      <Card data-testid="recent-users">
        <CardHeader>
          <CardTitle>Newest users</CardTitle>
        </CardHeader>
        {data.recentUsers.length === 0 ? (
          <p className="text-meta text-ink-muted">Nobody has joined yet.</p>
        ) : (
          <DataRows>
            {data.recentUsers.map((u) => (
              <RowSurface key={u.id}>
                <Link to={`/admin/users/${u.id}`} className="flex w-full items-center gap-3 no-underline">
                  <span className="flex flex-1 flex-col">
                    <span className="text-body font-extrabold text-ink">{u.name ?? 'No name yet'}</span>
                    <span className="num text-meta text-ink-muted">
                      {u.phone} · {societyLabel(u.society)}
                    </span>
                  </span>
                  {u.role === 'SUPER_ADMIN' && <span className="text-meta font-bold text-brand-ink">Admin</span>}
                </Link>
              </RowSurface>
            ))}
          </DataRows>
        )}
      </Card>
    </div>
  );
}

/** FEAT-034: the console's opening section: platform numbers, quick actions, what's newest. */
export function AdminOverview() {
  const overview = useAdminOverview();
  return (
    <div className="flex flex-col gap-4" data-testid="admin-overview">
      <nav aria-label="Quick actions" className="flex flex-wrap gap-2.5">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.to + action.label} to={action.to} className={ACTION_LINK}>
            <Icon name={action.icon} size={16} strokeWidth={2} />
            {action.label}
          </Link>
        ))}
      </nav>
      {overview.isPending ? (
        <SkeletonScreen label="Loading overview…" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" radius="card" delay={i as 0 | 1 | 2 | 3} />
          ))}
        </SkeletonScreen>
      ) : overview.isError ? (
        <Notice tone="error">{errorMessage(overview.error, "Couldn't load the overview.")}</Notice>
      ) : (
        <>
          <Stats data={overview.data} />
          <Recent data={overview.data} />
        </>
      )}
    </div>
  );
}
