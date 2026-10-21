import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { registerCalls, resetMockRegisterSW, setMockRegisterSW, updateServiceWorkerCalls } from 'virtual:pwa-register/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';
import { ServiceWorkerProvider } from './ServiceWorkerProvider';

const withSw = (ui: React.ReactElement) => render(<ServiceWorkerProvider>{ui}</ServiceWorkerProvider>);

describe('UpdatePrompt', () => {
  beforeEach(() => {
    resetMockRegisterSW();
  });

  it('stays out of the way when no new worker is waiting', () => {
    withSw(<UpdatePrompt />);
    expect(screen.queryByTestId('update-prompt')).not.toBeInTheDocument();
  });

  it('offers a reload when a new version is waiting, and activates it on click', async () => {
    setMockRegisterSW({ needRefresh: true });
    withSw(<UpdatePrompt />);

    expect(screen.getByTestId('update-prompt')).toHaveTextContent(/new version is ready/i);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    // `true` = activate the waiting worker AND reload the page.
    await waitFor(() => expect(updateServiceWorkerCalls).toEqual([true]));
  });
});

describe('ServiceWorkerProvider (FEAT-029)', () => {
  beforeEach(() => {
    resetMockRegisterSW();
  });

  it('registers once at the root, so a page outside the app shell is covered too', () => {
    withSw(<p>sign-in page</p>);
    expect(registerCalls.count).toBe(1);
  });

  it('UpdatePrompt never registers a second copy, and is inert outside the provider', () => {
    setMockRegisterSW({ needRefresh: true });
    render(<UpdatePrompt />);
    expect(registerCalls.count).toBe(0);
    expect(screen.queryByTestId('update-prompt')).not.toBeInTheDocument();
  });

});
