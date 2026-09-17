import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

const NAV_ITEMS: Array<{ to: string; label: string; end: boolean }> = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/rounds/new', label: 'New round', end: true },
  { to: '/admin/vendors', label: 'Vendors', end: true },
  { to: '/', label: 'Back to app', end: true },
];

/**
 * Shell for the super-admin pages: a wrapping header nav and a wider content area
 * than the resident screens (tables need the room on desktop).
 */
export function AdminLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-lg font-bold text-slate-900">Bulk Saving Admin</span>
          <nav aria-label="Admin" className="flex flex-wrap gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-semibold',
                    isActive && item.to !== '/'
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-700 hover:bg-slate-100',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {children}
      </main>
    </div>
  );
}
