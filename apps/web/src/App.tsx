import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminDashboardPage } from './features/admin/AdminDashboardPage';
import { AdminNewRoundPage } from './features/admin/AdminNewRoundPage';
import { AdminRoundDetailPage } from './features/admin/AdminRoundDetailPage';
import { AdminRoute } from './features/admin/AdminRoute';
import { AdminVendorsPage } from './features/admin/AdminVendorsPage';
import { OnboardingPage } from './features/auth/OnboardingPage';
import { AnonymousRoute, ProtectedRoute } from './features/auth/ProtectedRoute';
import { ServicesPage } from './features/catalog/ServicesPage';
import { HomePage } from './features/home/HomePage';
import { RoundsPage } from './features/rounds/RoundsPage';

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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ServicesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rounds"
        element={
          <ProtectedRoute>
            <RoundsPage />
          </ProtectedRoute>
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
