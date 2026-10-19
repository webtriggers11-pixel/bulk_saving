import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResult, ResidentDto } from '@bulk/shared';
import { AdminLoginPage } from './AdminLoginPage';
import { useAuthStore } from './auth.store';

const admin: ResidentDto = {
  id: 'res_admin',
  societyId: 'soc_1',
  phone: '+919999900001',
  name: 'Platform Admin',
  role: 'SUPER_ADMIN',
  verifiedAt: '2026-09-16T00:00:00.000Z',
  createdAt: '2026-09-16T00:00:00.000Z',
};

const authResult: AuthResult = {
  accessToken: 'access-admin',
  refreshToken: 'refresh-admin',
  resident: admin,
};

interface MockResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

function jsonResponse({ ok, status, body }: MockResponse) {
  return { ok, status, json: () => Promise.resolve(body) };
}

/** Every request body this page sent, keyed by endpoint — so a test can assert what
 *  was NOT in it, which is the whole point of the admin door. */
const sentBodies = new Map<string, unknown>();

function installFetch(verify: MockResponse) {
  sentBodies.clear();
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (typeof init?.body === 'string') {
      sentBodies.set(url.replace(/^.*(\/auth\/)/, '$1'), JSON.parse(init.body));
    }
    if (url.endsWith('/auth/admin/otp/request')) {
      return Promise.resolve(
        jsonResponse({ ok: true, status: 200, body: { success: true, data: { requested: true } } }),
      );
    }
    if (url.endsWith('/auth/admin/otp/verify')) {
      return Promise.resolve(jsonResponse(verify));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function renderAdminLogin() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<p>Admin dashboard</p>} />
          <Route path="/" element={<p>Resident home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function walkToCodeStep() {
  fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+919999900001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
  await waitFor(() => expect(screen.getByLabelText('6-digit code')).toBeInTheDocument());
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * AC7. Asserted as an absence across BOTH steps, because the bug this prevents is a
   * field creeping back in later — not one being there today.
   */
  it('never asks for an invite code', async () => {
    installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderAdminLogin();

    expect(screen.queryByLabelText(/invite/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/invite code/i);

    await walkToCodeStep();
    expect(screen.queryByLabelText(/invite/i)).not.toBeInTheDocument();
  });

  it('sends the phone alone, then signs in and opens the dashboard (AC8)', async () => {
    installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderAdminLogin();

    await walkToCodeStep();

    // The body carries a phone and nothing else — no society, no invite code (ADR-0003).
    expect(sentBodies.get('/auth/admin/otp/request')).toEqual({ phone: '+919999900001' });

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open dashboard' }));

    await waitFor(() => expect(screen.getByText('Admin dashboard')).toBeInTheDocument());
    expect(sentBodies.get('/auth/admin/otp/verify')).toEqual({
      phone: '+919999900001',
      code: '123456',
    });
    expect(useAuthStore.getState().accessToken).toBe('access-admin');
    expect(useAuthStore.getState().resident?.role).toBe('SUPER_ADMIN');
  });

  it('a bare 10-digit admin number is sent as +91… (BUG-019)', async () => {
    installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderAdminLogin();
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '09999900001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(screen.getByLabelText('6-digit code')).toBeInTheDocument());
    expect(sentBodies.get('/auth/admin/otp/request')).toEqual({ phone: '+919999900001' });
    // The code step shows the canonical number back.
    expect(screen.getByText('+919999900001')).toBeInTheDocument();
  });

  it('an implausible number keeps Send code off, with the hint (BUG-019)', () => {
    installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderAdminLogin();
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '12345' } });
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
    expect(screen.getByTestId('admin-phone-hint')).toBeInTheDocument();
  });

  it('explains NOT_AN_ADMIN in words a resident can act on, and signs nobody in', async () => {
    installFetch({
      ok: false,
      status: 403,
      body: {
        success: false,
        error: { code: 'NOT_AN_ADMIN', message: 'This number is not an administrator.' },
      },
    });
    renderAdminLogin();

    await walkToCodeStep();
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open dashboard' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/not an administrator/i);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument();
  });

  it('says on the page who this door is for, since the API will not (ADR-0023)', () => {
    installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderAdminLogin();

    // The request endpoint answers identically for everyone, so a resident who lands
    // here would otherwise wait for an SMS that is never sent.
    expect(screen.getByText(/for society administrators/i)).toBeInTheDocument();
  });
});
