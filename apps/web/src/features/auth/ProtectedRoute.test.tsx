import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { ResidentDto } from '@bulk/shared';
import { AnonymousRoute, ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from './auth.store';

function person(role: ResidentDto['role']): ResidentDto {
  return {
    id: 'res_1',
    societyId: 'soc_1',
    phone: '+919876543210',
    name: 'Priya',
    role,
    verifiedAt: '2026-09-16T00:00:00.000Z',
    createdAt: '2026-09-16T00:00:00.000Z',
  };
}

function signInAs(role: ResidentDto['role']) {
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'access',
    refreshToken: 'refresh',
    resident: person(role),
  });
}

/** The real route table's shape: both doors, both destinations. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Resident home</p>} />
        <Route path="/admin" element={<p>Admin dashboard</p>} />
        <Route
          path="/onboard"
          element={
            <AnonymousRoute>
              <p>Resident door</p>
            </AnonymousRoute>
          }
        />
        <Route
          path="/admin/login"
          element={
            <AnonymousRoute to="/admin">
              <p>Admin door</p>
            </AnonymousRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <p>Profile</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AnonymousRoute / ProtectedRoute', () => {
  afterEach(() => {
    useAuthStore.getState().logout();
  });

  it('shows each door to a signed-out visitor', () => {
    renderAt('/onboard');
    expect(screen.getByText('Resident door')).toBeInTheDocument();
  });

  it('shows the admin door to a signed-out visitor', () => {
    renderAt('/admin/login');
    expect(screen.getByText('Admin door')).toBeInTheDocument();
  });

  /**
   * FEAT-012: the `to` prop's whole reason for existing. An admin who already has a
   * session and opens the admin door wants the dashboard, not the resident home —
   * and this wiring in App.tsx had no test (V2, plausible finding).
   */
  it('sends a signed-in admin from the admin door to the dashboard, not home', () => {
    signInAs('SUPER_ADMIN');
    renderAt('/admin/login');

    expect(screen.getByText('Admin dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Resident home')).not.toBeInTheDocument();
  });

  it('still sends a signed-in resident from the resident door home', () => {
    signInAs('RESIDENT');
    renderAt('/onboard');

    expect(screen.getByText('Resident home')).toBeInTheDocument();
  });

  it('sends a signed-out visitor away from a protected route', () => {
    renderAt('/profile');
    expect(screen.queryByText('Profile')).not.toBeInTheDocument();
  });
});
