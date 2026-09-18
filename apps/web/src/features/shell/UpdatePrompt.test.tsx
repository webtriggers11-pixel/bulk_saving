import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resetMockRegisterSW, setMockRegisterSW, updateServiceWorkerCalls } from 'virtual:pwa-register/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

describe('UpdatePrompt', () => {
  beforeEach(() => {
    resetMockRegisterSW();
  });

  it('stays out of the way when no new worker is waiting', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByTestId('update-prompt')).not.toBeInTheDocument();
  });

  it('offers a reload when a new version is waiting, and activates it on click', async () => {
    setMockRegisterSW({ needRefresh: true });
    render(<UpdatePrompt />);

    expect(screen.getByTestId('update-prompt')).toHaveTextContent(/new version is ready/i);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    // `true` = activate the waiting worker AND reload the page.
    await waitFor(() => expect(updateServiceWorkerCalls).toEqual([true]));
  });
});
