import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../lib/api';
import { useDevWhatsApp } from './useDevWhatsApp';

vi.mock('../../lib/api', () => ({ apiRequest: vi.fn() }));
const apiMock = vi.mocked(apiRequest);

/** FEAT-027 (ADR-0037's gates): the simulator talks only in a DEV build, and never in tests unless asked. */
describe('useDevWhatsApp', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    apiMock.mockReset();
  });

  it('in a DEV build: sends the login message as the number, then shows the business reply; a tap sends the button id', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    const prompt = { body: 'Which number is on your screen?', buttons: [{ id: 'wa-login:BS-7KQ2MX:47', title: '47' }], at: '2026-10-20T10:00:00.000Z' };
    apiMock.mockImplementation(async (path: string) => (path.startsWith('/dev/whatsapp/prompt') ? prompt : { handled: true }));
    const { result } = renderHook(() => useDevWhatsApp('BS-7KQ2MX'));
    await act(async () => {
      await result.current.sendMessage('99999 00201');
    });
    expect(apiMock).toHaveBeenCalledWith('/dev/whatsapp/inbound', { method: 'POST', body: { from: '+919999900201', text: 'My Bulk Saving login code is BS-7KQ2MX', name: 'Dev Tester' }, auth: false });
    await waitFor(() => expect(result.current.prompt).toEqual(prompt));

    const later = { ...prompt, body: "That's it — you're signed in.", buttons: [], at: '2026-10-20T10:00:05.000Z' };
    apiMock.mockImplementation(async (path: string) => (path.startsWith('/dev/whatsapp/prompt') ? later : { handled: true }));
    await act(async () => {
      await result.current.tap('+919999900201', 'wa-login:BS-7KQ2MX:47');
    });
    expect(apiMock).toHaveBeenCalledWith('/dev/whatsapp/tap', { method: 'POST', body: { from: '+919999900201', buttonId: 'wa-login:BS-7KQ2MX:47' }, auth: false });
    await waitFor(() => expect(result.current.prompt?.body).toContain("you're signed in"));
  });

  it('outside a DEV build it never calls anything', async () => {
    vi.stubEnv('DEV', false);
    const { result } = renderHook(() => useDevWhatsApp('BS-7KQ2MX'));
    await act(async () => {
      await result.current.sendMessage('+919999900201');
    });
    expect(apiMock).not.toHaveBeenCalled();
    expect(result.current.prompt).toBeNull();
  });
});
