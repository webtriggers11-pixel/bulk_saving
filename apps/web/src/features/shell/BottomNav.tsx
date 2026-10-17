import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../../components/ui/icon';

/** BRIEF.md resident navigation, in its stated order. */
const TABS: ReadonlyArray<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/services', label: 'Services', icon: 'services' },
  { to: '/my-requests', label: 'My Requests', icon: 'requests' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
] as const;

/**
 * Thumb-reachable tab bar (FEAT-008 AC1/AC3). `min-h-tab` is 58 px — comfortably
 * over the 44 px floor — and the bar clears the iOS home indicator via the
 * safe-area inset, so the last tab is never half under the system gesture area.
 *
 * FEAT-011 makes it the app's one permanently glass surface: blur 28 over a white
 * gradient, a hairline top edge, and an active pill that bounces on tap above a
 * gradient underline.
 */
/** Which tab the path belongs to; Home only on `/` exactly, as NavLink decides. */
function activeIndex(pathname: string): number {
  const index = TABS.findIndex((tab) => (tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to)));
  return index;
}

export function BottomNav() {
  const { pathname } = useLocation();
  const active = activeIndex(pathname);
  return (
    <nav
      aria-label="Main"
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-paper/80 bg-gradient-to-b from-paper/60 to-paper/95 px-2.5 pb-[env(safe-area-inset-bottom)] pt-2 shadow-nav backdrop-blur-chrome backdrop-saturate-200"
    >
      <ul className="relative mx-auto flex max-w-md items-stretch gap-1">
        {/* FEAT-016: ONE pill that slides to the active tab with a little overshoot,
            instead of a pill per tab that blinks on and off — the native tab bar. Its
            position is a transform of its own width (+ the 4px gap) per tab. */}
        {active >= 0 && (
          <li
            aria-hidden="true"
            data-testid="tab-pill"
            className="tab-pill pointer-events-none absolute left-0 top-1.5 flex h-[30px] w-[calc((100%-12px)/4)] justify-center"
            style={{ transform: `translateX(calc(${active} * (100% + 4px)))` }}
          >
            <span className="block h-full w-11 rounded-chip border border-paper/70 bg-gradient-to-br from-brand-light/35 to-brand/15 shadow-lift" />
          </li>
        )}
        {TABS.map((tab) => (
          <li key={tab.to} className="relative flex flex-1">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                [
                  'group flex min-h-tab min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-inset px-1 py-1.5 text-[10.5px] font-semibold no-underline t',
                  isActive ? 'text-brand-ink' : 'text-ink-muted',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex h-[30px] w-11 items-center justify-center rounded-chip t group-hover:-translate-y-0.5 group-active:scale-90">
                    <Icon name={tab.icon} size={21} strokeWidth={isActive ? 2 : 1.7} />
                  </span>
                  <span className={isActive ? 'font-extrabold' : undefined}>{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
