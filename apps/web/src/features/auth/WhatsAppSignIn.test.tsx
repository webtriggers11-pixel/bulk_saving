import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WaStartResponse } from '@bulk/shared';
import { WhatsAppSignIn, isPhoneLike } from './WhatsAppSignIn';
import type { useWhatsAppLogin } from './useWhatsAppLogin';

vi.mock('qrcode', () => ({ toDataURL: vi.fn(async () => 'data:image/png;base64,QR') }));

const session: WaStartResponse = {
  requestId: 'r'.repeat(43),
  code: 'BS-7KQ2MX',
  waLink: 'https://wa.me/919876543210?text=My%20Bulk%20Saving%20login%20code%20is%20BS-7KQ2MX',
  matchNumber: 47,
  expiresAt: new Date(Date.now() + 180_000).toISOString(),
};

type Login = ReturnType<typeof useWhatsAppLogin>;
function login(view: Login['view'], extra: Partial<Login> = {}): Login {
  return { view, start: vi.fn(), reset: vi.fn(), startError: null, queuedOffline: false, stalled: false, ...extra };
}

/** FEAT-027 (ADR-0038 §8): the step shows the number, the steps and the live line. */
describe('WhatsAppSignIn', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts on mount when idle', () => {
    const l = login({ phase: 'idle' });
    render(<WhatsAppSignIn login={l} onUseSms={vi.fn()} phoneLike />);
    expect(l.start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Use an SMS code instead' })).toBeInTheDocument();
  });

  it('on a phone: the match number, the steps, "Open WhatsApp" opening the wa.me link, and the live status', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const { rerender } = render(<WhatsAppSignIn login={login({ phase: 'pending', session })} onUseSms={vi.fn()} phoneLike />);
    expect(screen.getByTestId('whatsapp-match-number')).toHaveTextContent('47');
    expect(screen.getByTestId('whatsapp-status')).toHaveTextContent('Waiting for your message…');
    expect(screen.queryByTestId('whatsapp-qr')).toBeNull();
    fireEvent.click(screen.getByTestId('whatsapp-open'));
    expect(open).toHaveBeenCalledWith(session.waLink, '_blank', 'noopener');

    rerender(<WhatsAppSignIn login={login({ phase: 'awaiting_confirm', session })} onUseSms={vi.fn()} phoneLike />);
    expect(screen.getByTestId('whatsapp-status')).toHaveTextContent('Message received. Now tap 47 in WhatsApp.');

    rerender(<WhatsAppSignIn login={login({ phase: 'awaiting_confirm', session }, { stalled: true })} onUseSms={vi.fn()} phoneLike />);
    expect(screen.getByTestId('whatsapp-status')).toHaveTextContent('Waiting for a connection…');
  });

  it('on a laptop: a QR of the same link and a link for WhatsApp Web; no Open button', async () => {
    render(<WhatsAppSignIn login={login({ phase: 'pending', session })} onUseSms={vi.fn()} phoneLike={false} />);
    expect(screen.queryByTestId('whatsapp-open')).toBeNull();
    await waitFor(() => expect(screen.getByRole('img', { name: /QR code/ })).toHaveAttribute('src', 'data:image/png;base64,QR'));
    expect(screen.getByRole('link', { name: /Open the chat/ })).toHaveAttribute('href', session.waLink);
  });

  it('denied and expired say so plainly and offer to start again (reset, then start)', () => {
    const l = login({ phase: 'denied', session, reason: 'WRONG_NUMBER' });
    const { rerender } = render(<WhatsAppSignIn login={l} onUseSms={vi.fn()} phoneLike />);
    expect(screen.getByTestId('whatsapp-denied')).toHaveTextContent("That wasn't the number on this screen, so nothing happened.");
    expect(screen.queryByTestId('whatsapp-status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Start again/ }));
    expect(l.reset).toHaveBeenCalledTimes(1);
    expect(l.start).toHaveBeenCalledTimes(1);

    rerender(<WhatsAppSignIn login={login({ phase: 'denied', session, reason: 'NOT_AN_ADMIN' })} onUseSms={vi.fn()} phoneLike />);
    expect(screen.getByTestId('whatsapp-denied')).toHaveTextContent('not an administrator');

    rerender(<WhatsAppSignIn login={login({ phase: 'expired', session })} onUseSms={vi.fn()} phoneLike />);
    expect(screen.getByTestId('whatsapp-expired')).toHaveTextContent('This sign-in expired');
  });

  it('the SMS fallback is always one tap away; a start error is shown; offline is honest', () => {
    const onUseSms = vi.fn();
    render(<WhatsAppSignIn login={login({ phase: 'idle' }, { startError: new Error('Server down'), queuedOffline: true })} onUseSms={onUseSms} phoneLike />);
    fireEvent.click(screen.getByRole('button', { name: 'Use an SMS code instead' }));
    expect(onUseSms).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Server down');
    expect(screen.getByTestId('whatsapp-offline')).toBeInTheDocument();
    // Vitest runs with MODE=test: the dev panel never renders here (ADR-0037's gate).
    expect(screen.queryByTestId('dev-whatsapp-panel')).toBeNull();
  });

  it('tells a phone from a laptop by the user agent', () => {
    expect(isPhoneLike('Mozilla/5.0 (Linux; Android 14) Chrome/129 Mobile Safari/537.36')).toBe(true);
    expect(isPhoneLike('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe(true);
    expect(isPhoneLike('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/129 Safari/537.36')).toBe(false);
  });
});
