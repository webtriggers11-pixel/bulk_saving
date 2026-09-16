import { Navigate, Route, Routes } from 'react-router-dom';
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
