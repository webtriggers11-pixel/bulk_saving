import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './auth.store';

/** Renders children only when authenticated; otherwise redirects to /onboard. A platform admin goes to /admin. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  // FEAT-036 (ADR-0046): a platform admin has no society, so the resident app has nothing for them.
  const platformAdmin = useAuthStore((state) => state.resident?.societyId === null);
  if (status !== 'authenticated') {
    return <Navigate to="/onboard" replace />;
  }
  if (platformAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}

/**
 * Renders children only when NOT authenticated; otherwise redirects.
 *
 * `to` exists because there are now two sign-in doors: an admin who already has a
 * session and opens `/admin/login` wants the dashboard, not the resident home. A
 * resident sent to `/admin` from here is bounced onward to `/` by `AdminRoute`, so the
 * role decision stays in the one place that makes it (FEAT-012).
 */
export function AnonymousRoute({ children, to = '/' }: { children: ReactNode; to?: string }) {
  const status = useAuthStore((state) => state.status);
  if (status === 'authenticated') {
    return <Navigate to={to} replace />;
  }
  return <>{children}</>;
}
