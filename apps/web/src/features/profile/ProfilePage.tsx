import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../auth/auth.store';
import { isStandalone, useInstallPrompt } from '../shell/useInstallPrompt';
import { useOnlineStatus } from '../shell/useOnlineStatus';
import { Button } from '../../components/ui/button';
import { Icon, type IconName } from '../../components/ui/icon';
import { Badge } from '../../components/ui/badge';
import { Card, CardEyebrow, CardTitle } from '../../components/ui/card';

/** Human label for a role enum — the resident should not read SUPER_ADMIN. */
const ROLE_LABEL: Record<string, string> = {
  RESIDENT: 'Resident',
  SUPER_ADMIN: 'Super admin',
};

/** One identity fact as a tile; two sit side by side under the hero. */
function Tile({
  icon,
  term,
  value,
  sub,
  testId,
}: {
  icon: IconName;
  term: string;
  value: string;
  sub?: string;
  testId: string;
}) {
  return (
    <Card surface="solid" className="flex min-h-[134px] flex-col p-[18px]">
      <span className="flex h-[42px] w-[42px] items-center justify-center rounded-control border border-white/85 bg-gradient-to-br from-brand-light/25 to-brand/5 text-brand-ink">
        <Icon name={icon} size={20} strokeWidth={1.8} />
      </span>
      <p className="mt-auto pt-3.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-soft">
        {term}
      </p>
      <p className="num mt-1.5 text-[15.5px] font-extrabold text-ink" data-testid={testId}>
        {value}
      </p>
      {sub && <p className="mt-1 text-meta text-ink-muted">{sub}</p>}
    </Card>
  );
}

/**
 * Profile tab (FEAT-008 AC4/AC5): who am I, log out, and the device-level
 * concerns of an installable app. Reads the session store, not the network, so
 * it works offline — it is the one page that must never need a request.
 *
 * FEAT-011 lays it out as a bento: a centred identity hero with the role as a
 * badge, then the facts as tiles. Same fields, same source, same offline promise.
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resident = useAuthStore((state) => state.resident);
  const society = useAuthStore((state) => state.society);
  const logout = useAuthStore((state) => state.logout);
  const { canInstall, promptInstall } = useInstallPrompt();
  const online = useOnlineStatus();
  // Already running from the home screen: there is nothing to install, and the
  // hint would tell an Android user to go find a menu item they already used
  // (V2 P2-6).
  const installed = isStandalone();

  function handleLogout() {
    logout();
    // Clear cached server data too: the next resident on this phone must not
    // see the previous one's rounds (ADR-0015).
    queryClient.clear();
    navigate('/onboard', { replace: true });
  }

  const name = resident?.name ?? 'Resident';

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-[22px]">
      <h1 className="animate-rise text-display font-extrabold text-ink">Profile</h1>

      <div className="stagger grid grid-cols-2 gap-3.5">
        <Card className="col-span-2 overflow-hidden p-6 text-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-52 w-64 -translate-x-1/2 rounded-full bg-mesh-1/40 blur-2xl"
          />
          <span className="relative inline-flex h-[70px] w-[70px] items-center justify-center overflow-hidden rounded-card paint-mono text-[24px] font-extrabold text-white shadow-accent">
            <span className="animate-halo halo-sweep absolute -inset-1/2" />
            <span className="relative" data-testid="profile-initials">
              {initialsOf(name)}
            </span>
          </span>
          <CardEyebrow className="mt-4">Signed in as</CardEyebrow>
          <CardTitle className="animate-blur-in mt-2 text-[25px]" data-testid="profile-name">
            {name}
          </CardTitle>
          <p className="mt-3">
            <Badge tone="teal" icon={<Icon name="profile" size={13} strokeWidth={2.2} />}>
              <span data-testid="profile-role">
                {resident ? (ROLE_LABEL[resident.role] ?? resident.role) : '—'}
              </span>
            </Badge>
          </p>
        </Card>

        <Tile icon="phone" term="Phone" value={resident?.phone ?? '—'} testId="profile-phone" />
        <Tile icon="building" term="Society" value={society?.name ?? '—'} testId="profile-society" />

        <Card surface="tint" className="col-span-2 p-[22px]">
          <div className="flex items-start gap-4">
            <span className="animate-breathe flex h-12 w-12 shrink-0 items-center justify-center rounded-inset border border-white/90 bg-gradient-to-br from-white/95 to-white/55 text-brand-ink shadow-lift">
              <Icon name="install" size={23} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <CardEyebrow>This app</CardEyebrow>
              <CardTitle className="mt-2 text-title">
                {installed ? 'Installed' : 'Add to your home screen'}
              </CardTitle>
              {installed ? (
                <p className="mt-2 text-meta text-ink-muted" data-testid="installed-note">
                  You&apos;re running the installed app.
                </p>
              ) : canInstall ? (
                <Button variant="primary" size="sm" className="mt-3" onClick={() => void promptInstall()}>
                  <Icon name="install" size={16} strokeWidth={2.1} />
                  Install app
                </Button>
              ) : (
                <p className="mt-2 text-meta text-ink-muted" data-testid="install-hint">
                  On iPhone: tap Share, then &quot;Add to Home Screen&quot;. On Android, use your
                  browser&apos;s &quot;Install app&quot; menu item.
                </p>
              )}
              <p
                className={[
                  'mt-3.5 inline-flex items-center gap-2 rounded-full border border-white/70 px-3 py-1.5 text-micro font-extrabold',
                  online ? 'bg-success-ink/15 text-success-ink' : 'bg-amber-ink/15 text-amber-ink',
                ].join(' ')}
                data-testid="connection-state"
              >
                <span
                  aria-hidden="true"
                  className={[
                    'h-[7px] w-[7px] rounded-full',
                    online ? 'animate-pulse-ring-green bg-success-ink' : 'bg-amber-ink',
                  ].join(' ')}
                />
                {online ? 'Connected' : "Offline — you can still open the app, but rounds won't be current."}
              </p>
            </div>
          </div>
        </Card>

        <Button variant="secondary" className="col-span-2 w-full" onClick={handleLogout}>
          <Icon name="logout" size={18} strokeWidth={2} />
          Log out
        </Button>
      </div>
    </main>
  );
}

/** "Priya Sharma" -> "PS". Falls back to a glyph rather than an empty circle. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '·';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
