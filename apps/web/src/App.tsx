import { Navigate, Route, Routes } from 'react-router-dom';
import { OnboardingPage } from './features/auth/OnboardingPage';
import { AnonymousRoute, ProtectedRoute } from './features/auth/ProtectedRoute';
import { HomePage } from './features/home/HomePage';

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
