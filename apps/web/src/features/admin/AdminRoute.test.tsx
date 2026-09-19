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
        <Route path="/admin/login" element={<p>Admin sign-in page</p>} />
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

  // FEAT-012 (AC9): this used to land on the resident door, which asks for an invite
  // code — a society credential — before it will let an admin reach their dashboard.
  it('sends an unauthenticated visitor to the admin door, not the resident one', () => {
    renderAtAdmin();
    expect(screen.getByText('Admin sign-in page')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding page')).not.toBeInTheDocument();
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
