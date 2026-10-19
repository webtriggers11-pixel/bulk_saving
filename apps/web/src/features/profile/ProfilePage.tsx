import { useState, type ReactNode } from 'react';
import { useAuthStore } from '../auth/auth.store';
import { useSignOut } from '../auth/useSignOut';
import { isStandalone, useInstallPrompt } from '../shell/useInstallPrompt';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { Button } from '../../components/ui/button';
import { Icon, type IconName } from '../../components/ui/icon';
import { Badge } from '../../components/ui/badge';
import { Card, CardEyebrow, CardTitle } from '../../components/ui/card';
import { Monogram } from '../../components/ui/monogram';
import { PageHeader } from '../../components/ui/page-header';
import { SchemeToggle } from '../../components/ui/scheme-toggle';
import { useAppearance } from '../../lib/appearance';
import { AppearanceSheet, describeAppearance } from '../appearance/AppearanceSheet';
import { NotificationsRow } from '../push/NotificationsRow';

/** Human label for a role enum — the resident should not read SUPER_ADMIN. */
const ROLE_LABEL: Record<string, string> = {
  RESIDENT: 'Resident',
  SUPER_ADMIN: 'Super admin',
};

/** The icon box every row and tile on this page shares (BUG-016: one size, 44px). */
const ICON_BOX =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-paper/85 bg-gradient-to-br from-brand-light/25 to-brand/5 text-brand-ink';

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
    <Card padding="none" surface="solid" className="flex min-h-[134px] flex-col p-[18px]">
      <span className={ICON_BOX}>
        <Icon name={icon} size={20} strokeWidth={1.8} />
      </span>
      {/* BUG-016: top-aligned under the icon, like the tiles on Home — bottom-aligned, a value
          that wrapped to two lines lifted its label above its neighbour's. */}
      <p className="mt-4 term-label">
        {term}
      </p>
      <p className="num mt-1.5 text-[15.5px] font-extrabold text-ink" data-testid={testId}>
        {value}
      </p>
      {sub && <p className="mt-1 text-meta text-ink-muted">{sub}</p>}
    </Card>
  );
}

/** The row every device setting shares (CHORE-024): icon · title · one line · a trailing control. */
const ROW = 'surface-solid col-span-2 flex min-h-touch items-center gap-4 rounded-card p-[18px] text-left';

/**
 * A setting that is itself a target (Appearance) renders as a button; one that carries its
 * own control (Install, Notifications) renders as a plain row. Same skin either way, so the
 * three stop drifting apart — the install card used to be a tinted feature card with a
 * breathing icon, a paragraph and a pill, next to two quiet rows (CHORE-024).
 */
function SettingsRow({
  icon,
  title,
  line,
  lineTestId,
  trailing,
  onClick,
  'data-testid': testId,
}: {
  icon: IconName;
  title: string;
  line: ReactNode;
  lineTestId?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  'data-testid'?: string;
}) {
  const body = (
    <>
      <span className={ICON_BOX}>
        <Icon name={icon} size={20} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-extrabold text-ink">{title}</span>
        <span className="mt-0.5 block text-meta text-ink-muted" data-testid={lineTestId}>
          {line}
        </span>
      </span>
      {trailing}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        className={`${ROW} card-hover press t focus-visible:shadow-focus focus-visible:outline-none`}
        data-testid={testId}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={ROW} data-testid={testId}>
      {body}
    </div>
  );
}

/**
 * Profile tab (FEAT-008 AC4/AC5): who am I, log out, and the device-level
 * concerns of an installable app. Reads the session store, not the network, so
 * it works offline — it is the one page that must never need a request.
 *
 * FEAT-011 lays it out as a bento: a centred identity hero with the role as a
 * badge, then the facts as tiles. CHORE-024: below them, ONE list of this phone's
 * settings in one row shape — install, appearance, notifications — then log out.
 */
export function ProfilePage() {
  const resident = useAuthStore((state) => state.resident);
  const society = useAuthStore((state) => state.society);
  const signOut = useSignOut();
  const { canInstall, promptInstall } = useInstallPrompt();
  const online = useOnlineStatus();
  // Already running from the home screen: there is nothing to install, and the
  // hint would tell an Android user to go find a menu item they already used
  // (V2 P2-6).
  const installed = isStandalone();

  const name = resident?.name ?? 'Resident';
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { preference, palette } = useAppearance();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 p-[22px]">
      <PageHeader title="Profile" action={<SchemeToggle />} collapsible />

      <div className="stagger grid grid-cols-2 gap-3.5">
        <Card padding="none" className="col-span-2 overflow-hidden p-[22px] text-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-52 w-64 -translate-x-1/2 rounded-full bg-mesh-1/40 blur-2xl"
          />
          <Monogram name={name} size="lg" className="relative" data-testid="profile-initials" />
          <CardEyebrow className="mt-4">Signed in as</CardEyebrow>
          <CardTitle size="2xl" className="animate-blur-in mt-2" data-testid="profile-name">
            {name}
          </CardTitle>
          <p className="mt-3">
            <Badge tone="teal" icon={<Icon name="profile" size={13} strokeWidth={2.2} />}>
              <span data-testid="profile-role">
                {resident ? (ROLE_LABEL[resident.role] ?? resident.role) : '—'}
              </span>
            </Badge>
          </p>
          {/* CHORE-024: the connection is a quiet status under the identity, not a pill
              fighting a button inside the install card. */}
          <p
            className={[
              'mt-3 inline-flex items-center gap-2 text-micro font-bold',
              online ? 'text-success-ink' : 'text-amber-ink',
            ].join(' ')}
            data-testid="connection-state"
          >
            <span
              aria-hidden="true"
              className={['h-[7px] w-[7px] rounded-full', online ? 'animate-pulse-ring-green bg-success-ink' : 'bg-amber-ink'].join(' ')}
            />
            {online ? 'Connected' : "Offline — you can still open the app, but rounds won't be current."}
          </p>
        </Card>

        <Tile icon="phone" term="Phone" value={resident?.phone ?? '—'} testId="profile-phone" />
        <Tile icon="building" term="Society" value={society?.name ?? '—'} testId="profile-society" />

        {installed ? (
          <SettingsRow
            icon="install"
            title="Installed"
            line="You're running the app from your home screen."
            lineTestId="installed-note"
          />
        ) : canInstall ? (
          <SettingsRow
            icon="install"
            title="Install app"
            line="Add it to your home screen for one-tap access."
            trailing={
              <Button variant="primary" size="sm" onClick={() => void promptInstall()}>
                Install app
              </Button>
            }
          />
        ) : (
          <SettingsRow
            icon="install"
            title="Add to your home screen"
            line={
              <>
                On iPhone: tap Share, then &quot;Add to Home Screen&quot;. On Android, use your
                browser&apos;s &quot;Install app&quot; menu item.
              </>
            }
            lineTestId="install-hint"
          />
        )}

        {/* FEAT-016: how the app looks on this phone — opens the Appearance sheet. */}
        <SettingsRow
          icon="palette"
          title="Appearance"
          line={describeAppearance(preference, palette)}
          lineTestId="appearance-summary"
          trailing={<Icon name="forward" size={18} strokeWidth={2} className="nudge text-ink-soft" />}
          onClick={() => setAppearanceOpen(true)}
        />
        <AppearanceSheet open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />

        {/* FEAT-020: web push for this phone. */}
        <NotificationsRow />

        <Button variant="secondary" className="col-span-2 w-full" onClick={() => void signOut()}>
          <Icon name="logout" size={18} strokeWidth={2} />
          Log out
        </Button>
      </div>
    </main>
  );
}
