import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignOutButton } from './SignOutButton';
import { useAuthStore } from './auth.store';
import { signIn, signOutAfterTest } from '../../test/session';

vi.mock('./auth.api', () => ({ endSession: vi.fn().mockResolvedValue({ signedOut: true }) }));
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

function renderButton(variant: 'icon' | 'wide') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SignOutButton variant={variant} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SignOutButton (FEAT-024)', () => {
  beforeEach(() => {
    navigate.mockClear();
    signIn();
  });
  afterEach(() => {
    signOutAfterTest();
  });

  it.each(['icon', 'wide'] as const)('%s: asks first, and backing out keeps the session', (variant) => {
    renderButton(variant);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByRole('dialog', { name: 'Log out of this phone?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('confirming signs out', async () => {
    renderButton('wide');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, log out' }));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('unauthenticated'));
    expect(navigate).toHaveBeenCalledWith('/onboard', { replace: true });
  });
});
