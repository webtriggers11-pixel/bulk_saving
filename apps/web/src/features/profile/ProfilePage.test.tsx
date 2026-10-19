import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { resetInstallPrompt } from '../shell/useInstallPrompt';
import { useAuthStore } from '../auth/auth.store';
import { signIn, signOutAfterTest } from '../../test/session';

const navigate = vi.fn();
const endSession = vi.fn().mockResolvedValue({ signedOut: true });
vi.mock('../auth/auth.api', () => ({ endSession: (...args: unknown[]) => endSession(...args) }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

/** Fire the Chromium-only install event with a promptable stub. */
function fireBeforeInstallPrompt(prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void> };
  event.prompt = prompt;
  // The hook's listener sets state on a mounted component — inside act (CHORE-013).
  act(() => {
    window.dispatchEvent(event);
  });
  return prompt;
}

describe('ProfilePage', () => {
  beforeEach(() => {
    navigate.mockClear();
    resetInstallPrompt();
    useAuthStore.getState().logout();
    signIn();
  });

  afterEach(() => {
    resetInstallPrompt();
  });

  afterEach(() => {
    signOutAfterTest();
  });

  it('shows the session identity from the store — no request needed, so it works offline', () => {
    renderProfile();

    expect(screen.getByTestId('profile-name')).toHaveTextContent('Asha');
    expect(screen.getByTestId('profile-phone')).toHaveTextContent('+919812345678');
    expect(screen.getByTestId('profile-society')).toHaveTextContent('Green Meadows');
    expect(screen.getByTestId('profile-role')).toHaveTextContent('Resident');
  });

  it('shows a human role label, never the raw enum', () => {
    useAuthStore.getState().logout();
    signIn({ resident: { role: 'SUPER_ADMIN' } });
    renderProfile();

    expect(screen.getByTestId('profile-role')).toHaveTextContent('Super admin');
    expect(screen.getByTestId('profile-role')).not.toHaveTextContent('SUPER_ADMIN');
  });

  it('logs out: clears the session, clears cached server data, lands on onboarding', async () => {
    const { client } = renderProfile();
    client.setQueryData(['rounds'], [{ id: 'round-1' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    // FEAT-024: it asks first.
    fireEvent.click(screen.getByRole('button', { name: 'Yes, log out' }));

    // FEAT-020: sign-out first releases this phone from push (bounded), then clears.
    await waitFor(() => expect(useAuthStore.getState().status).toBe('unauthenticated'));
    expect(useAuthStore.getState().accessToken).toBeNull();
    // BUG-017: the server is told to end THIS device's session, with the token it held.
    expect(endSession).toHaveBeenCalledWith({ refreshToken: 'test-refresh-token' });
    // ADR-0015: the next resident on this phone must not see these rounds.
    expect(client.getQueryData(['rounds'])).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/onboard', { replace: true });
  });

  it('offers no install button until the browser says the app is installable', () => {
    renderProfile();

    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
    // iOS Safari never fires the event, so the hint is what a resident there sees.
    expect(screen.getByTestId('install-hint')).toHaveTextContent(/Add to Home Screen/i);
  });

  /**
   * V2 P1-1. Chromium fires `beforeinstallprompt` ONCE on load, on whatever
   * route the resident landed on, and never again on an SPA route change — so
   * in production it has always fired BEFORE the Profile tab is opened. The
   * original tests dispatched it after render, the one ordering that never
   * happens, and so passed against a hook that missed the event every time.
   */
  it('offers Install for an event that fired BEFORE this tab was ever opened', async () => {
    fireBeforeInstallPrompt();

    renderProfile();

    expect(await screen.findByRole('button', { name: 'Install app' })).toBeInTheDocument();
    expect(screen.queryByTestId('install-hint')).not.toBeInTheDocument();
  });

  it('offers Install once the event fires, prompts on click, then stops offering', async () => {
    renderProfile();
    const prompt = fireBeforeInstallPrompt();

    const button = await screen.findByRole('button', { name: 'Install app' });
    fireEvent.click(button);

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    // The event is single-use: the control must not linger after a choice.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument());
    expect(screen.getByTestId('install-hint')).toBeInTheDocument();
  });

  it('stops offering Install once the app reports itself installed', async () => {
    renderProfile();
    fireBeforeInstallPrompt();
    expect(await screen.findByRole('button', { name: 'Install app' })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument());
  });

  it('reports the connection state', async () => {
    renderProfile();
    expect(screen.getByTestId('connection-state')).toHaveTextContent('Connected');

    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => expect(screen.getByTestId('connection-state')).toHaveTextContent(/Offline/i));
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });
});
