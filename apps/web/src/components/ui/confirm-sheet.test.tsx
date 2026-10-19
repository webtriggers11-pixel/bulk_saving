import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmSheet } from './confirm-sheet';

function renderSheet(overrides: Partial<Parameters<typeof ConfirmSheet>[0]> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const utils = render(
    <ConfirmSheet
      open
      onClose={onClose}
      onConfirm={onConfirm}
      title="Leave this round?"
      consequence="Your pledge of 2 units is withdrawn."
      confirmLabel="Yes, leave"
      pendingLabel="Leaving…"
      keepLabel="Keep my pledge"
      {...overrides}
    />,
  );
  return { onClose, onConfirm, ...utils };
}

describe('ConfirmSheet (FEAT-024)', () => {
  it('is a dialog named by the question, with the consequence and both ways out', () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'Leave this round?' })).toBeInTheDocument();
    expect(screen.getByTestId('confirm-consequence')).toHaveTextContent('Your pledge of 2 units is withdrawn.');
    expect(screen.getByRole('button', { name: 'Yes, leave' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep my pledge' })).toBeInTheDocument();
  });

  it('confirm runs the action and nothing else; keep closes and runs nothing', () => {
    const { onClose, onConfirm } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep my pledge' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Escape backs out', () => {
    const { onClose, onConfirm } = renderSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('while the action runs both buttons wait and the confirm says so', () => {
    renderSheet({ busy: true });
    expect(screen.getByRole('button', { name: 'Leaving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep my pledge' })).toBeDisabled();
  });

  it('a failed action is said inside the sheet, which stays open', () => {
    renderSheet({ error: 'Could not leave just now.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not leave just now.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    renderSheet({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
