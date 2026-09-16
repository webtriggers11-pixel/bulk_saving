import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useAuthStore } from './features/auth/auth.store';

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

describe('App routing', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().logout();
    // A stub so the health/me queries never hit the network in these tests.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: {} }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the onboarding screen at /onboard', () => {
    renderAppAt('/onboard');
    expect(screen.getByRole('heading', { name: 'Bulk Saving' })).toBeInTheDocument();
    expect(screen.getByLabelText('Invite code')).toBeInTheDocument();
  });

  it('ProtectedRoute redirects an unauthenticated visitor from / to onboarding', () => {
    renderAppAt('/');
    // The protected home never renders; we land on the onboarding invite step.
    expect(screen.getByLabelText('Invite code')).toBeInTheDocument();
  });
});
