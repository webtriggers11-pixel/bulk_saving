import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../auth/auth.store';
import { resident } from './admin.fixtures';
import { AdminRoute } from './AdminRoute';

function renderAtAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/onboard" element={<p>Onboarding page</p>} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <p>Admin content</p>
            </AdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function signInAs(role: 'RESIDENT' | 'SUPER_ADMIN') {
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'access',
    refreshToken: 'refresh',
    resident: resident(role),
  });
}

describe('AdminRoute', () => {
  afterEach(() => {
    useAuthStore.getState().logout();
  });

  it('sends an unauthenticated visitor to /onboard', () => {
    renderAtAdmin();
    expect(screen.getByText('Onboarding page')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('sends a resident home', () => {
    signInAs('RESIDENT');
    renderAtAdmin();
    expect(screen.getByText('Home page')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('renders the admin page for a super-admin', () => {
    signInAs('SUPER_ADMIN');
    renderAtAdmin();
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });
});
