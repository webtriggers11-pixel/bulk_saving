import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './auth.store';

/** Renders children only when authenticated; otherwise redirects to /onboard. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  if (status !== 'authenticated') {
    return <Navigate to="/onboard" replace />;
  }
  return <>{children}</>;
}

/** Renders children only when NOT authenticated; otherwise redirects home. */
export function AnonymousRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
