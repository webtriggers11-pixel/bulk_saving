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
 * Route the mocked fetch by URL; verify can be overridden to fail. The OTP request
 * payload is `{ requested: true }` and nothing else — CHORE-007 removed the dev code
 * from the response entirely, so there is no toast to test any more.
 */
function installFetch(verify: MockResponse, requestData: unknown = { requested: true }) {
  // `init` is received (and recorded by vi.fn) so a test can read the body it sent (BUG-019).
  const mock = vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
    const url = String(args[0]);
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
    vi.unstubAllEnvs();
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

  it('sends a bare number in its canonical form, and shows that form back (BUG-019)', async () => {
    const mock = installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderOnboarding();
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '99999 00201' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(screen.getByLabelText('6-digit code')).toBeInTheDocument());

    const request = mock.mock.calls.find(([url]) => String(url).endsWith('/auth/otp/request'));
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ inviteCode: 'AB12CD34', phone: '+919999900201' });
    expect(screen.getByText('+919999900201')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'));
    const verify = mock.mock.calls.find(([url]) => String(url).endsWith('/auth/otp/verify'));
    expect(JSON.parse(String(verify?.[1]?.body))).toMatchObject({ phone: '+919999900201' });
  });

  it('an implausible number keeps Send code off and says what a number must look like (BUG-019)', async () => {
    installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderOnboarding();
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '022 2345 6789' } });
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
    expect(screen.getByTestId('phone-hint')).toHaveTextContent(/10-digit mobile/);
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-describedby', 'phone-hint');
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '98765 43210' } });
    expect(screen.queryByTestId('phone-hint')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled();
  });

  it('a number the server refuses gets the phone message, not a generic apology (BUG-019)', async () => {
    const mock = vi.fn((...args: [RequestInfo | URL, RequestInit?]) =>
      String(args[0]).endsWith('/auth/otp/request')
        ? Promise.resolve(jsonResponse({ ok: false, status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'phone must be a valid phone number.' } } }))
        : Promise.reject(new Error('unexpected')),
    );
    vi.stubGlobal('fetch', mock);
    renderOnboarding();
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+1 415 555 2671' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/doesn't look like a phone number/)).toBeInTheDocument();
  });

  it('DEV build: the code the stub "sent" arrives as a top toast, and "Use it" fills the field (FEAT-026)', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    const mock = vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
      const url = String(args[0]);
      if (url.endsWith('/auth/otp/request')) return Promise.resolve(jsonResponse({ ok: true, status: 200, body: { success: true, data: { requested: true } } }));
      if (url.includes('/dev/otp?phone=')) return Promise.resolve(jsonResponse({ ok: true, status: 200, body: { success: true, data: { code: '654321' } } }));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', mock);
    renderOnboarding();
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+919999900201' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByTestId('dev-otp-code')).toHaveTextContent('654321');
    expect(screen.getByRole('status').parentElement).toHaveAttribute('data-placement', 'top');
    expect(screen.getByText('Dev only')).toBeInTheDocument();
    expect(mock.mock.calls.some(([url]) => String(url).includes('/dev/otp?phone=%2B919999900201'))).toBe(true);

    fireEvent.click(screen.getByTestId('dev-otp-use'));
    expect(screen.getByLabelText('6-digit code')).toHaveValue('654321');
    expect(screen.queryByTestId('dev-otp-code')).not.toBeInTheDocument();
  });

  it('DEV build without the dev route (404): no toast, nothing else changes', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    const mock = vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
      const url = String(args[0]);
      if (url.endsWith('/auth/otp/request')) return Promise.resolve(jsonResponse({ ok: true, status: 200, body: { success: true, data: { requested: true } } }));
      if (url.includes('/dev/otp')) return Promise.resolve(jsonResponse({ ok: false, status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'no' } } }));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', mock);
    renderOnboarding();
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+919999900201' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(screen.getByLabelText('6-digit code')).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByTestId('dev-otp-code')).not.toBeInTheDocument();
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
    // Nothing was SENT: the only call so far is the page asking which methods exist (FEAT-027).
    expect(mock.mock.calls.filter(([url]) => !String(url).endsWith('/auth/methods'))).toHaveLength(0);

    act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() =>
      expect(mock.mock.calls.some(([url]) => String(url).endsWith('/auth/otp/request'))).toBe(true),
    );
  });
});

/** FEAT-027 (ADR-0038 §8): WhatsApp leads when the server offers it; the SMS code stays one tap away. */
describe('OnboardingPage — sign in with WhatsApp', () => {
  const session = {
    requestId: 'r'.repeat(43),
    code: 'BS-7KQ2MX',
    waLink: 'https://wa.me/919876543210?text=x',
    matchNumber: 47,
    expiresAt: new Date(Date.now() + 180_000).toISOString(),
  };

  function installWhatsAppFetch(statuses: unknown[]) {
    const sent = new Map<string, unknown>();
    const queue = [...statuses];
    const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (typeof init?.body === 'string') sent.set(url.replace(/^.*(\/auth\/)/, '$1'), JSON.parse(init.body));
      if (url.endsWith('/auth/methods')) return Promise.resolve(jsonResponse({ ok: true, status: 200, body: { success: true, data: { whatsapp: true } } }));
      if (url.endsWith('/auth/wa/start')) return Promise.resolve(jsonResponse({ ok: true, status: 200, body: { success: true, data: session } }));
      if (url.includes('/auth/wa/status/')) {
        const next = queue.length > 1 ? queue.shift() : queue[0];
        return Promise.resolve(jsonResponse({ ok: true, status: 200, body: { success: true, data: next } }));
      }
      if (url.endsWith('/auth/otp/request')) return Promise.resolve(jsonResponse({ ok: true, status: 200, body: { success: true, data: { requested: true } } }));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', mock);
    return { mock, sent };
  }

  beforeEach(() => {
    useAuthStore.getState().logout();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('after the invite code offers WhatsApp or an SMS code; WhatsApp starts a request for that invite code and signs in when confirmed', async () => {
    const { sent } = installWhatsAppFetch([{ status: 'pending' }, { status: 'confirmed', ...authResult }]);
    renderOnboarding();
    // The method list arrives while the person types the invite code; the test waits for it.
    await waitFor(() => expect(screen.getByRole('main')).toHaveAttribute('data-whatsapp', 'on'));
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByTestId('onboarding-choose')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('continue-whatsapp'));
    await waitFor(() => expect(screen.getByTestId('whatsapp-match-number')).toHaveTextContent('47'));
    expect(sent.get('/auth/wa/start')).toEqual({ inviteCode: 'AB12CD34' });
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'), { timeout: 6_000 });
    expect(useAuthStore.getState().accessToken).toBe('access-1');
  });

  it('"Use an SMS code instead" returns to the phone step, and Back from there returns to the choice', async () => {
    installWhatsAppFetch([{ status: 'pending' }]);
    renderOnboarding();
    await waitFor(() => expect(screen.getByRole('main')).toHaveAttribute('data-whatsapp', 'on'));
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByTestId('onboarding-choose')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('continue-whatsapp'));
    await waitFor(() => expect(screen.getByTestId('whatsapp-sign-in')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Use an SMS code instead' }));
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('onboarding-choose')).toBeInTheDocument();
  });

  it('when the server does not offer WhatsApp, the invite code leads straight to the phone step', async () => {
    installFetch({ ok: true, status: 200, body: { success: true, data: authResult } });
    renderOnboarding();
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'AB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument();
    expect(screen.queryByTestId('continue-whatsapp')).toBeNull();
  });
});
