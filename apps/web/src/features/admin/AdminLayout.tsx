import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CrashCard, ErrorBoundary } from '../../components/ErrorBoundary';
import { SchemeToggle } from '../../components/ui/scheme-toggle';
import { AmbientGround } from '../../components/ui/ambient-ground';
import { Icon, type IconName } from '../../components/ui/icon';
import { PageHeader } from '../../components/ui/page-header';
import { cn } from '../../lib/utils';

const NAV_ITEMS: Array<{ to: string; label: string; end: boolean; icon: IconName }> = [
  { to: '/admin', label: 'Dashboard', end: true, icon: 'services' },
  { to: '/admin/rounds/new', label: 'New round', end: true, icon: 'plus' },
  { to: '/admin/services', label: 'Services', end: true, icon: 'service' },
  { to: '/admin/vendors', label: 'Vendors', end: true, icon: 'users' },
  { to: '/', label: 'Back to app', end: true, icon: 'back' },
];

/**
 * Shell for the super-admin pages: a wrapping header nav and a wider content area
 * than the resident screens (tables need the room on desktop).
 *
 * CHORE-008 puts it on the same system as the resident app — same ground, same glass,
 * same pill for the active item as the resident tab bar, same icon family. The only
 * difference from the resident shell is density and width, which is what actually
 * separates an operator's screen from a resident's (ADR-0022).
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
  return (
    <div className="relative min-h-screen">
      <AmbientGround id="admin-grain" />

      <header className="sticky top-0 z-20 border-b border-paper/80 bg-gradient-to-b from-paper/70 to-paper/95 shadow-nav backdrop-blur-chrome backdrop-saturate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <span className="order-1 flex items-center gap-2.5">
            <span className="animate-breathe flex h-9 w-9 items-center justify-center rounded-chip paint-mono text-on-fill shadow-accent">
              <Icon name="bolt" size={19} strokeWidth={1.9} />
            </span>
            <span className="text-body font-extrabold tracking-[-0.03em] text-ink">
              Bulk Saving <span className="text-brand-ink">Admin</span>
            </span>
          </span>
          <nav aria-label="Admin" className="order-3 flex w-full flex-wrap items-center gap-1 sm:order-2 sm:w-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'group t press flex min-h-11 items-center gap-2 rounded-control border px-3.5 text-meta font-bold no-underline',
                    isActive && item.to !== '/'
                      ? 'border-paper/70 bg-gradient-to-br from-brand-light/35 to-brand/15 text-brand-ink shadow-lift'
                      : 'border-transparent text-ink-muted hover:bg-paper/60',
                  )
                }
              >
                <Icon name={item.icon} size={17} strokeWidth={1.9} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          {/* FEAT-016: the night switch, same gesture as the resident app. Ordered beside the
              brand on a phone (the nav takes its own full row below), after the nav on wider
              screens — one control, placed by `order`, never rendered twice. */}
          <SchemeToggle className="order-2 ml-auto sm:order-3 sm:ml-0" />
        </div>
      </header>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7">
        <PageHeader title={title} subtitle={subtitle} action={action} />
        <ErrorBoundary resetKey={pathname} fallback={(reset) => <CrashCard onRetry={reset} />}>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
