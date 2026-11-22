import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resetMockRegisterSW, setMockRegisterSW, updateServiceWorkerCalls } from 'virtual:pwa-register/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ServiceWorkerProvider } from '../shell/ServiceWorkerProvider';
import { AdminLayout } from './AdminLayout';

/** BUG-025 V2: a new build reaches admins through the same switch as residents. */
describe('AdminLayout update switch (BUG-025)', () => {
  beforeEach(() => {
    resetMockRegisterSW();
  });

  function renderAdmin() {
    // BUG-029: the sidebar reads the overview query, as it does under the app's provider.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
    render(
      <QueryClientProvider client={client}>
        <ServiceWorkerProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <AdminLayout title="Dashboard">
              <p>content</p>
            </AdminLayout>
          </MemoryRouter>
        </ServiceWorkerProvider>
      </QueryClientProvider>,
    );
  }

  it('shows nothing while no new build is waiting', () => {
    renderAdmin();
    expect(screen.queryByTestId('update-prompt')).toBeNull();
  });

  it('offers Reload when one is waiting, and activates it', async () => {
    setMockRegisterSW({ needRefresh: true });
    renderAdmin();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(updateServiceWorkerCalls).toEqual([true]));
  });
});
