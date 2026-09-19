import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResidentDto } from '@bulk/shared';
import App from './App';
import { useAuthStore } from './features/auth/auth.store';

/**
 * The ROUTE TABLE, not a component.
 *
 * `ProtectedRoute.test.tsx` mounts `<AnonymousRoute to="/admin">` itself, so it proves
 * the prop works and says nothing about whether `App.tsx` passes it. Deleting
 * `to="/admin"` from the real route left all 285 web tests green (V2 round 2, P3-E) —
 * a signed-in admin opening the admin door would land on the resident home and nothing
 * would notice. These tests render the app's own table.
 */
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
    society: { id: 'soc_1', name: 'Green Meadows', city: 'Pune' },
  });
}

function renderAppAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App route table', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().logout();
    // Every screen behind these routes fetches; none of the assertions depend on the
    // data, only on which screen mounted.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline in test'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a signed-in admin from /admin/login to the dashboard', async () => {
    signInAs('SUPER_ADMIN');
    renderAppAt('/admin/login');

    // "Dashboard" is both the page title and the nav link, so anchor on the heading.
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument(),
    );
    expect(screen.queryByText('Your admin number')).not.toBeInTheDocument();
  });

  it('shows the admin door at /admin/login when signed out', async () => {
    renderAppAt('/admin/login');

    await waitFor(() => expect(screen.getByText('Your admin number')).toBeInTheDocument());
  });

  it('sends a signed-out visitor from /admin to the admin door, not the resident one', async () => {
    renderAppAt('/admin');

    await waitFor(() => expect(screen.getByText('Your admin number')).toBeInTheDocument());
    expect(screen.queryByText('Enter your invite code')).not.toBeInTheDocument();
  });

  it('sends a signed-in resident from /onboard to the resident home', async () => {
    signInAs('RESIDENT');
    renderAppAt('/onboard');

    await waitFor(() => expect(screen.queryByText('Enter your invite code')).not.toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
