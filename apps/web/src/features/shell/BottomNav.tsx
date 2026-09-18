import { NavLink } from 'react-router-dom';

/** BRIEF.md resident navigation, in its stated order. */
const TABS = [
  { to: '/', label: 'Home', icon: 'M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/services', label: 'Services', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/my-requests', label: 'My Requests', icon: 'M5 13l4 4L19 7' },
  { to: '/profile', label: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 2-7 4.5V21h14v-2.5c0-2.5-3-4.5-7-4.5z' },
] as const;

/**
 * Thumb-reachable tab bar (FEAT-008 AC1/AC3). `min-h-11` is 44 px — the minimum
 * comfortable touch target — and the bar clears the iOS home indicator via the
 * safe-area inset, so the last tab is never half under the system gesture area.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                [
                  'flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-2 py-2 text-xs font-medium',
                  isActive ? 'text-teal-700' : 'text-slate-500',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isActive ? 2.2 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d={tab.icon} />
                  </svg>
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
