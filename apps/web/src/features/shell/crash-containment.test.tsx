import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLayout } from '../admin/AdminLayout';
import { AppShell } from './AppShell';
import { CrashScreen, ErrorBoundary } from '../../components/ErrorBoundary';

/**
 * BUG-011: one component that throws while rendering blanked the whole app — there was
 * no error boundary anywhere. A crash must stay inside the screen that crashed: the
 * resident keeps the tab bar, the admin keeps the nav, and both get a way out.
 */
function Boom(): never {
  throw new Error('render failed');
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/services']}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BUG-011 — a crashing screen does not take the app down with it', () => {
  beforeEach(() => {
    // React logs caught render errors; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resident: the tab bar survives and the screen says what happened', () => {
    wrap(
      <AppShell>
        <Boom />
      </AppShell>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('admin: the nav survives and the screen says what happened', () => {
    wrap(
      <AdminLayout title="Services">
        <Boom />
      </AdminLayout>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('navigation', { name: 'Admin' })).toBeInTheDocument();
  });

  it('"Try again" renders the screen afresh — a transient failure recovers in place', () => {
    let fail = true;
    function Flaky() {
      if (fail) throw new Error('once');
      return <p>Recovered</p>;
    }
    wrap(
      <AppShell>
        <Flaky />
      </AppShell>,
    );
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('leaving a crashed screen clears the crash — the next screen is not stuck on the error', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/broken']}>
          <AdminLayout title="Admin">
            <Routes>
              <Route path="/broken" element={<Boom />} />
              <Route path="/admin" element={<p>Working screen</p>} />
            </Routes>
          </AdminLayout>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // The nav is outside the boundary, so it still navigates.
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Working screen')).toBeInTheDocument();
  });

  it('a crash outside every screen gets the whole-app fallback, not a blank page', () => {
    render(
      <ErrorBoundary fallback={(reset) => <CrashScreen onRetry={reset} />}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Reload the app' })).toBeInTheDocument();
  });
});
