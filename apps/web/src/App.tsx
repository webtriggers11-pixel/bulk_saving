import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';
import { AdminNewRoundPage } from './features/admin/AdminNewRoundPage';
import { AdminRoundDetailPage } from './features/admin/AdminRoundDetailPage';
import { AdminRoute } from './features/admin/AdminRoute';
import { AdminLoginPage } from './features/auth/AdminLoginPage';
import { AdminServicesPage } from './features/admin/AdminServicesPage';
import { AdminVendorsPage } from './features/admin/AdminVendorsPage';
import { OnboardingPage } from './features/auth/OnboardingPage';
import { AnonymousRoute, ProtectedRoute } from './features/auth/ProtectedRoute';
import { ServicesPage } from './features/catalog/ServicesPage';
import { HomePage } from './features/home/HomePage';
import { ProfilePage } from './features/profile/ProfilePage';
import { MyRequestsPage } from './features/requests/MyRequestsPage';
import { RoundsPage } from './features/rounds/RoundsPage';
import { AppShell } from './features/shell/AppShell';

export default function App() {
  return (
    <Routes>
      <Route
        path="/onboard"
        element={
          <AnonymousRoute>
            <OnboardingPage />
          </AnonymousRoute>
        }
      />
      {/* Resident routes carry the app shell: tab bar, offline + update strips
          (FEAT-008). /onboard and /admin/* deliberately stay outside it. */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell>
              <HomePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <AppShell>
              <ServicesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rounds"
        element={
          <ProtectedRoute>
            <AppShell>
              <RoundsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-requests"
        element={
          <ProtectedRoute>
            <AppShell>
              <MyRequestsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppShell>
              <ProfilePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      {/* The admin door is public and sits OUTSIDE AdminRoute — a guard that redirects
          the signed-out to this page cannot also be the thing guarding it. */}
      <Route
        path="/admin/login"
        element={
          <AnonymousRoute to="/admin">
            <AdminLoginPage />
          </AnonymousRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/rounds/new"
        element={
          <AdminRoute>
            <AdminNewRoundPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/rounds/:id"
        element={
          <AdminRoute>
            <AdminRoundDetailPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/services"
        element={
          <AdminRoute>
            <AdminServicesPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/vendors"
        element={
          <AdminRoute>
            <AdminVendorsPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
