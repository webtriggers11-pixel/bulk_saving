import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { AdminLayout } from './AdminLayout';
import { fetchOverview } from './admin.api';

vi.mock('./admin.api', () => ({
  fetchOverview: vi.fn().mockResolvedValue({ societies: 1, users: 1, admins: 1, openRounds: 0, waitingAsks: 0, recentSocieties: [], recentUsers: [] }),
}));
import { useAuthStore } from '../auth/auth.store';

function renderAt(path: string) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<AdminLayout title="Page">content</AdminLayout>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminLayout — sidebar and drawer (FEAT-034)', () => {
  it('the sidebar groups every section', () => {
    renderAt('/admin');
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    for (const group of ['Overview', 'Onboarding', 'Group buys', 'Catalog']) expect(within(nav).getByText(group)).toBeInTheDocument();
    for (const link of ['Dashboard', 'Societies', 'Users', 'Requests', 'Rounds', 'New round', 'Reports', 'Services', 'Vendors', 'Back to app']) {
      expect(within(nav).getByRole('link', { name: link })).toBeInTheDocument();
    }
  });

  it('a child page keeps its section marked', () => {
    renderAt('/admin/societies/soc_1');
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: 'Societies' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('on a phone the menu button opens the drawer; Escape closes it and focus returns', () => {
    renderAt('/admin/users');
    const button = screen.getByTestId('admin-menu-button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    const drawer = screen.getByRole('dialog', { name: 'Admin menu' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(drawer).getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
    expect(drawer.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(button);
  });

  it('choosing a page in the drawer closes it', () => {
    renderAt('/admin');
    fireEvent.click(screen.getByTestId('admin-menu-button'));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Admin menu' })).getByRole('link', { name: 'Vendors' }));
    expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
  });

  it('the backdrop closes it', () => {
    renderAt('/admin');
    fireEvent.click(screen.getByTestId('admin-menu-button'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Close menu' })[0]);
    expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
  });

  it('a re-render while open keeps focus where it is; the page behind does not scroll (V2)', () => {
    const { rerender } = renderAt('/admin');
    fireEvent.click(screen.getByTestId('admin-menu-button'));
    const vendors = within(screen.getByRole('dialog', { name: 'Admin menu' })).getByRole('link', { name: 'Vendors' });
    vendors.focus();
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="*" element={<AdminLayout title="Page again">content</AdminLayout>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // The fix itself: focus stayed on Vendors through the re-render.
    expect(document.activeElement).toHaveTextContent('Vendors');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.body.style.overflow).toBe('');
  });

  it('Tab wraps inside the open drawer', () => {
    renderAt('/admin');
    fireEvent.click(screen.getByTestId('admin-menu-button'));
    const drawer = screen.getByRole('dialog', { name: 'Admin menu' });
    const focusable = [...drawer.querySelectorAll<HTMLElement>('a, button')];
    focusable[focusable.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusable[0]);
  });

  it('a platform admin (no society) gets no "Back to app" link (FEAT-036)', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'a',
      refreshToken: 'r',
      resident: { id: 'res_p', societyId: null, phone: '+919999900001', name: 'Platform', role: 'SUPER_ADMIN', verifiedAt: null, createdAt: '2026-11-01T00:00:00.000Z' },
    });
    try {
      renderAt('/admin');
      const nav = screen.getByRole('navigation', { name: 'Admin' });
      expect(within(nav).queryByRole('link', { name: 'Back to app' })).not.toBeInTheDocument();
      expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument();
    } finally {
      useAuthStore.setState({ status: 'unauthenticated', accessToken: null, refreshToken: null, resident: null, society: null });
    }
  });

  it('the sidebar counts waiting requests on Requests (BUG-029, FEAT-041)', async () => {
    vi.mocked(fetchOverview).mockResolvedValueOnce({ societies: 1, users: 1, admins: 1, openRounds: 0, waitingAsks: 2, recentSocieties: [], recentUsers: [] });
    renderAt('/admin/users');
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    const badge = await within(nav).findByTestId('nav-asks-badge');
    expect(badge).toHaveTextContent('2');
    expect(within(nav).getByRole('link', { name: /Requests.*2 waiting/ })).toBeInTheDocument();
  });

  it('Rounds stays lit on a round page but not on New round (FEAT-041 V2 P3-2)', () => {
    renderAt('/admin/rounds/round_1');
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: 'Rounds' })).toHaveAttribute('aria-current', 'page');
  });

  it('on New round only New round is lit (FEAT-041)', () => {
    renderAt('/admin/rounds/new');
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getByRole('link', { name: 'New round' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Rounds' })).not.toHaveAttribute('aria-current', 'page');
  });
});
