import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResponse, HealthStatus } from '@bulk/shared';
import App from './App';
import { useUiStore } from './store/ui.store';

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    const envelope: ApiResponse<HealthStatus> = {
      success: true,
      data: { status: 'ok', service: 'backend', timestamp: new Date().toISOString() },
    };
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(envelope),
    });
    vi.stubGlobal('fetch', mockFetch);
  });

  it('renders the heading', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Bulk Saving' })).toBeInTheDocument();
  });

  it('shows backend health once the query resolves', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('health-status')).toHaveTextContent('ok — backend');
    });
  });

  it('increments the Zustand counter demo on click', () => {
    useUiStore.setState({ count: 0 });
    renderApp();
    const button = screen.getByRole('button', { name: /Count:/ });
    expect(button).toHaveTextContent('Count: 0');
    fireEvent.click(button);
    expect(button).toHaveTextContent('Count: 1');
  });
});
