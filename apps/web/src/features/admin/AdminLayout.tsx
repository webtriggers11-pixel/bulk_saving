import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CrashCard, ErrorBoundary } from '../../components/ErrorBoundary';
import { SchemeToggle } from '../../components/ui/scheme-toggle';
import { AmbientGround } from '../../components/ui/ambient-ground';
import { Icon, type IconName } from '../../components/ui/icon';
import { PageHeader } from '../../components/ui/page-header';
import { cn } from '../../lib/utils';
import { UpdatePrompt } from '../shell/UpdatePrompt';
import { useAuthStore } from '../auth/auth.store';
import { useAdminOverview } from './useAdmin';

interface NavItem {
  to: string;
  label: string;
  /** Exact match only. Off for a section whose child pages should keep it lit. */
  end: boolean;
  icon: IconName;
}

/** The console's sections (FEAT-034): what an operator does, in the order they do it. */
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Overview', items: [{ to: '/admin', label: 'Dashboard', end: true, icon: 'services' }] },
  {
    label: 'Onboarding',
    items: [
      { to: '/admin/societies', label: 'Societies', end: false, icon: 'building' },
      { to: '/admin/users', label: 'Users', end: false, icon: 'profile' },
    ],
  },
  {
    label: 'Group buys',
    items: [
      { to: '/admin/requests', label: 'Requests', end: true, icon: 'bell' },
      { to: '/admin/rounds', label: 'Rounds', end: true, icon: 'clock' },
      { to: '/admin/rounds/new', label: 'New round', end: true, icon: 'plus' },
      { to: '/admin/reports', label: 'Reports', end: true, icon: 'trend' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/admin/services', label: 'Services', end: true, icon: 'service' },
      { to: '/admin/vendors', label: 'Vendors', end: true, icon: 'users' },
    ],
  },
];

function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="animate-breathe flex h-9 w-9 items-center justify-center rounded-chip paint-mono text-on-fill shadow-accent">
        <Icon name="bolt" size={19} strokeWidth={1.9} />
      </span>
      <span className="text-body font-extrabold tracking-[-0.03em] text-ink">
        Bulk Saving <span className="text-brand-ink">Admin</span>
      </span>
    </span>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group t press flex min-h-11 items-center gap-3 rounded-control border px-3.5 text-meta font-bold no-underline focus-visible:shadow-focus focus-visible:outline-none',
    isActive
      ? 'border-paper/70 bg-gradient-to-br from-brand-light/35 to-brand/15 text-brand-ink shadow-lift'
      : 'border-transparent text-ink-muted hover:bg-paper/60',
  );

/** The grouped section list, shared by the desktop sidebar and the phone drawer. */
function AdminNav({ label, onNavigate }: { label: string; onNavigate?: () => void }) {
  // FEAT-036 (ADR-0046): a platform admin has no resident app to go back to.
  const platformAdmin = useAuthStore((state) => state.resident?.societyId === null);
  // BUG-029 / FEAT-041: waiting requests are counted on Requests, on every admin page.
  const waiting = useAdminOverview().data?.waitingAsks ?? 0;
  return (
    <nav aria-label={label} className="flex flex-1 flex-col gap-5 overflow-y-auto">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span className="px-3.5 pb-1 text-eyebrow uppercase text-ink-soft">{group.label}</span>
          {group.items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onNavigate}>
              <Icon name={item.icon} size={18} strokeWidth={1.9} />
              {item.label}
              {item.to === '/admin/requests' && waiting > 0 && (
                <span
                  data-testid="nav-asks-badge"
                  className="num ml-auto inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-amber-ink/15 px-1.5 text-caption font-extrabold text-amber-ink"
                >
                  {waiting}
                  <span className="sr-only"> waiting</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
      {!platformAdmin && (
        <div className="mt-auto flex flex-col gap-1 border-t border-line/10 pt-4">
          <NavLink to="/" end className={() => linkClass({ isActive: false })} onClick={onNavigate}>
            <Icon name="back" size={18} strokeWidth={1.9} />
            Back to app
          </NavLink>
        </div>
      )}
    </nav>
  );
}

/**
 * The phone drawer (FEAT-034 AC2): the sidebar's nav sliding in from the left. Escape and
 * the backdrop close it; focus moves into it on open and back to the menu button on close.
 */
function NavDrawer({ open, onClose, returnFocus }: { open: boolean; onClose: () => void; returnFocus: () => HTMLElement | null }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>('a, button')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // The page behind a modal drawer does not scroll (V2 P3).
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const back = returnFocus;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      back()?.focus();
    };
  }, [open, onClose, returnFocus]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button type="button" aria-label="Close menu" className="absolute inset-0 size-full bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Admin menu"
        id="admin-drawer"
        className="animate-rise surface-solid bg-paper absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col gap-6 px-4 pb-6 pt-5 shadow-nav"
      >
        <div className="flex items-center justify-between">
          <Brand />
          <button type="button" aria-label="Close menu" onClick={onClose} className="flex size-11 items-center justify-center rounded-control text-ink-muted">
            <Icon name="close" size={20} strokeWidth={2} />
          </button>
        </div>
        <AdminNav label="Admin menu" onNavigate={onClose} />
      </div>
    </div>
  );
}

/**
 * Shell for the super-admin console (FEAT-034): a fixed left sidebar from `lg` up, and on a
 * phone a slim top bar whose menu button opens the same nav as a drawer.
 *
 * CHORE-008 keeps it on the same system as the resident app (same ground, glass, active pill
 * and icon family); what separates an operator's screen is density and width (ADR-0022).
 */
export function AdminLayout({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  /** A primary action for this screen, placed opposite the title. */
  action?: ReactNode;
  children: ReactNode;
}) {
  // BUG-011: a crashed screen stays inside the boundary below; the admin nav survives,
  // and moving to another page clears the crash.
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  // Stable identities (V2 P2): the drawer's effect depends on these, and fresh arrows on every
  // render re-ran it whenever the page re-rendered (a query landing), yanking focus to the top.
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuButtonEl = useCallback(() => menuButton.current, []);
  // Navigating (a link, Back, a redirect) always closes the drawer.
  useEffect(() => setMenuOpen(false), [pathname]);
  return (
    <div className="relative min-h-screen lg:flex">
      <AmbientGround id="admin-grain" />

      <aside className="sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col gap-7 border-r border-paper/80 bg-gradient-to-b from-paper/70 to-paper/95 px-4 pb-6 pt-6 shadow-nav backdrop-blur-chrome lg:flex">
        <Brand />
        <AdminNav label="Admin" />
        <SchemeToggle className="self-start" />
      </aside>

      <header className="sticky top-0 z-20 border-b border-paper/80 bg-gradient-to-b from-paper/70 to-paper/95 shadow-nav backdrop-blur-chrome backdrop-saturate-200 lg:hidden">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button
            ref={menuButton}
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="admin-drawer"
            onClick={() => setMenuOpen(true)}
            data-testid="admin-menu-button"
            className="flex size-11 items-center justify-center rounded-control border border-line/15 text-ink"
          >
            <Icon name="menu" size={20} strokeWidth={2} />
          </button>
          <Brand />
          <SchemeToggle className="ml-auto" />
        </div>
      </header>
      <NavDrawer open={menuOpen} onClose={closeMenu} returnFocus={menuButtonEl} />

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-7 lg:px-8">
        {/* BUG-025 V2: admins get the "new version" switch too, or a build waits until
            every window of the app is closed. */}
        <UpdatePrompt />
        <PageHeader title={title} subtitle={subtitle} action={action} />
        <ErrorBoundary resetKey={pathname} fallback={(reset) => <CrashCard onRetry={reset} />}>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
