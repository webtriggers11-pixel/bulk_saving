import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { AdminLayout } from './AdminLayout';

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
    for (const link of ['Dashboard', 'Societies', 'Users', 'New round', 'Services', 'Vendors', 'Back to app']) {
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
});
