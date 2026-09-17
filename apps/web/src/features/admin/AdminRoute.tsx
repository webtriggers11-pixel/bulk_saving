import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../auth/auth.store';

/**
 * Renders children only for an authenticated SUPER_ADMIN. Unauthenticated users go
 * to /onboard; residents go home. UX only: every /admin/* endpoint also enforces
 * the role server-side (403). The role is compared as a literal because @bulk/shared
 * is CommonJS and only type imports survive the Vite bundle.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.resident?.role);
  if (status !== 'authenticated') {
    return <Navigate to="/onboard" replace />;
  }
  if (role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
