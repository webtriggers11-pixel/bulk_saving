import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import type { AuthResult, ResidentDto } from '@bulk/shared';
import { OnboardingPage } from './OnboardingPage';
import { useAuthStore } from './auth.store';

const resident: ResidentDto = {
  id: 'res_1',
  societyId: 'soc_1',
  phone: '+919876543210',
  name: 'Priya',
  role: 'RESIDENT',
  verifiedAt: '2026-09-16T00:00:00.000Z',
  createdAt: '2026-09-16T00:00:00.000Z',
};

const authResult: AuthResult = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  resident,
};

interface MockResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

function jsonResponse({ ok, status, body }: MockResponse) {
  return { ok, status, json: () => Promise.resolve(body) };
}

/**
 * Route the mocked fetch by URL; verify can be overridden to fail, and the OTP
 * request payload can carry the DEV-ONLY `devCode` (CHORE-002).
 */
function installFetch(verify: MockResponse, requestData: unknown = { requested: true }) {
  const mock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/otp/request')) {
      return Promise.resolve(
        jsonResponse({ ok: true, status: 200, body: { success: true, data: requestData } }),
      );
    }
    if (url.endsWith('/auth/otp/verify')) {
      return Promise.resolve(jsonResponse(verify));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function renderOnboarding() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/onboard']}>
        <OnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function walkToOtpStep(mock: ReturnType<typeof installFetch>) {
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+919876543210' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

  await waitFor(() => expect(screen.getByLabelText('6-digit code')).toBeInTheDocument());
  expect(mock.mock.calls.some(([url]) => String(url).endsWith('/auth/otp/request'))).toBe(true);
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    useAuthStore.getState().logout();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
  });

  it('requests an OTP after invite + phone, then verifies and authenticates', async () => {
    const mock = installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderOnboarding();

    await walkToOtpStep(mock);

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    expect(mock.mock.calls.some(([url]) => String(url).endsWith('/auth/otp/verify'))).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('access-1');
  });

  it('renders a friendly message when verify returns OTP_INVALID', async () => {
    const mock = installFetch({
      ok: false,
      status: 400,
      body: { success: false, error: { code: 'OTP_INVALID', message: 'Incorrect code.' } },
    });
    renderOnboarding();

    await walkToOtpStep(mock);

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/incorrect/i);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('shows the DEV-ONLY code in a toast when the API returns one', async () => {
    const mock = installFetch(
      { ok: true, status: 200, body: { success: true, data: authResult } },
      { requested: true, devCode: '246813' },
    );
    renderOnboarding();

    await walkToOtpStep(mock);

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('246813');
    expect(toast).toHaveTextContent(/dev only/i);
  });

  it('shows NO toast in a real environment, where the API omits devCode', async () => {
    const mock = installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderOnboarding();

    await walkToOtpStep(mock);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('the dev toast can be dismissed', async () => {
    const mock = installFetch(
      { ok: true, status: 200, body: { success: true, data: authResult } },
      { requested: true, devCode: '135792' },
    );
    renderOnboarding();

    await walkToOtpStep(mock);
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('tells the resident the OTP request is QUEUED when offline, not stuck on "Sending…" (BUG-004)', async () => {
    // The app's front door: offline pauses the mutation, so isPending stayed true
    // forever with no explanation and no way to tell whether the SMS was requested.
    const mock = installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderOnboarding();

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+919876543210' } });

    act(() => {
      onlineManager.setOnline(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByTestId('onboarding-offline')).toHaveTextContent('reconnect');
    expect(mock).not.toHaveBeenCalled();

    act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() =>
      expect(mock.mock.calls.some(([url]) => String(url).endsWith('/auth/otp/request'))).toBe(true),
    );
  });
});
