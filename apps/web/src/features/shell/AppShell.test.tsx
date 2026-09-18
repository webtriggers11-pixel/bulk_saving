import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { useAuthStore } from '../auth/auth.store';
import { signIn } from '../../test/session';

/**
 * FEAT-008 AC1 + AC2, asserted through real routing rather than by rendering
 * AppShell directly: the question is which ROUTES get the shell.
 */
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

describe('AppShell route coverage', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().logout();
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
    useAuthStore.getState().logout();
  });

  it.each(['/', '/services', '/rounds', '/my-requests', '/profile'])('shows the tab bar on the resident route %s', (path) => {
    signIn();
    renderAppAt(path);

    expect(screen.getByTestId('bottom-nav')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Requests' })).toBeInTheDocument();
  });

  it('marks the tab bar entry for the route being viewed', () => {
    signIn();
    renderAppAt('/profile');

    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows NO tab bar on onboarding — there is nothing to navigate to yet', () => {
    renderAppAt('/onboard');

    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument();
  });

  it('shows NO tab bar on the admin dashboard — it has its own navigation', async () => {
    signIn({ resident: { role: 'SUPER_ADMIN' } });
    renderAppAt('/admin');

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument();
  });

  it('reserves space for the fixed bar so page content is never trapped under it', () => {
    signIn();
    renderAppAt('/profile');

    const nav = screen.getByTestId('bottom-nav');
    // The shell pads its content area; the bar clears the iOS home indicator.
    expect(nav.previousElementSibling?.className).toContain('pb-20');
    expect(nav.className).toContain('pb-[env(safe-area-inset-bottom)]');
  });
});
