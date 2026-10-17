import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CrashCard, ErrorBoundary } from '../../components/ErrorBoundary';
import { useAuthStore } from '../auth/auth.store';
import { AdminLayout } from './AdminLayout';

/**
 * Renders children only for an authenticated SUPER_ADMIN. Unauthenticated users go
 * to /admin/login — the door that asks for a phone number and nothing else (FEAT-012);
 * sending them to /onboard would have demanded a resident's invite code to reach the
 * admin dashboard. Residents go home. UX only: every /admin/* endpoint also enforces
 * the role server-side (403). The role is compared as a literal because @bulk/shared
 * is CommonJS and only type imports survive the Vite bundle.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const role = useAuthStore((state) => state.resident?.role);
  const { pathname } = useLocation();
  if (status !== 'authenticated') {
    return <Navigate to="/admin/login" replace />;
  }
  if (role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }
  // BUG-011 (V2 round 2): every admin page renders its OWN AdminLayout, so a page that
  // throws in its body — a hook, a grouping helper — throws before the layout's boundary
  // exists. This one wraps the whole page, and its fallback brings the nav back, so the
  // admin can always leave. Keyed by path: moving to another page clears it.
  return (
    <ErrorBoundary
      resetKey={pathname}
      fallback={(reset) => (
        <AdminLayout title="Admin">
          <CrashCard onRetry={reset} />
        </AdminLayout>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
