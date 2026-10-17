import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResidentDto } from '@bulk/shared';
import App from './App';
import { useAuthStore } from './features/auth/auth.store';

/**
 * BUG-011 through the REAL route table (V2 round 2). Each admin page renders its own
 * `AdminLayout`, so a page that throws in its body — a hook, a grouping helper — throws
 * before the layout's boundary exists. The first fix contained only crashes INSIDE the
 * layout, and a test that nested routes inside one layout could not tell.
 */
vi.mock('./features/admin/AdminServicesPage', () => ({
  AdminServicesPage: () => {
    throw new Error('page body failed');
  },
}));
vi.mock('./features/catalog/ServicesPage', () => ({
  ServicesPage: () => {
    throw new Error('page body failed');
  },
}));

function signInAs(role: ResidentDto['role']) {
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'access',
    refreshToken: 'refresh',
    resident: {
      id: 'res_1',
      societyId: 'soc_1',
      phone: '+919876543210',
      name: 'Priya',
      role,
      verifiedAt: '2026-09-16T00:00:00.000Z',
      createdAt: '2026-09-16T00:00:00.000Z',
    },
    society: { id: 'soc_1', name: 'Green Meadows', city: 'Pune' },
  });
}

function renderAppAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BUG-011 — a page that throws in its own body, on the real routes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline in test'))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
  });

  it('admin: the nav survives, and leads somewhere that works', () => {
    signInAs('SUPER_ADMIN');
    renderAppAt('/admin/services');
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('navigation', { name: 'Admin' })).toBeInTheDocument();
    // The nav leads out — and the next page (its own layout, its own nav) is not stuck
    // on the crash.
    fireEvent.click(screen.getByRole('link', { name: 'Vendors' }));
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vendors' })).toBeInTheDocument();
  });

  it('resident: the tab bar survives', () => {
    signInAs('RESIDENT');
    renderAppAt('/services');
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
