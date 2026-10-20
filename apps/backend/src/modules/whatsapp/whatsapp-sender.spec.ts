import {
  CloudApiWhatsAppSender,
  WhatsAppSendError,
  cloudButtonsPayload,
  cloudTextPayload,
  toWaId,
} from './whatsapp-sender';
import { StubWhatsAppSender, devWaPromptKey } from './stub-whatsapp.sender';
import type { RedisService } from '../../redis/redis.service';

const config = {
  phoneNumberId: '123456789012345',
  accessToken: 'EAAG-test-token',
  appSecret: 'secret',
  verifyToken: 'verify',
  businessNumber: '919876543210',
  graphVersion: 'v26.0',
};

/** FEAT-027 (ADR-0038): the documented Cloud API shapes, and their limits, as code. */
describe('Cloud API payloads', () => {
  it('builds an interactive reply-buttons message addressed by wa_id', () => {
    const payload = cloudButtonsPayload('+919999900201', 'Which number?', [
      { id: 'wa-login:BS-ABCDEF:47', title: '47' },
      { id: 'wa-login:BS-ABCDEF:82', title: '82' },
    ]);
    expect(payload).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '919999900201',
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Which number?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'wa-login:BS-ABCDEF:47', title: '47' } },
            { type: 'reply', reply: { id: 'wa-login:BS-ABCDEF:82', title: '82' } },
          ],
        },
      },
    });
    expect(toWaId('+1650555')).toBe('1650555');
    expect(cloudTextPayload('+919999900201', 'hi')).toMatchObject({ type: 'text', to: '919999900201', text: { body: 'hi' } });
  });

  it("refuses what Meta would refuse: more than 3 buttons, long titles, duplicates, an over-long body", () => {
    const b = (n: number) => ({ id: `id${n}`, title: `t${n}` });
    expect(() => cloudButtonsPayload('+91', 'x', [b(1), b(2), b(3), b(4)])).toThrow(/1–3 reply buttons/);
    expect(() => cloudButtonsPayload('+91', 'x', [])).toThrow(/1–3 reply buttons/);
    expect(() => cloudButtonsPayload('+91', 'x', [{ id: 'a', title: 'x'.repeat(21) }])).toThrow(/1–20 characters/);
    expect(() => cloudButtonsPayload('+91', 'x', [{ id: 'a', title: '1' }, { id: 'b', title: '1' }])).toThrow(/unique/);
    expect(() => cloudButtonsPayload('+91', 'x'.repeat(1025), [b(1)])).toThrow(/1024/);
  });
});

describe('CloudApiWhatsAppSender', () => {
  it('POSTs to the versioned messages endpoint with the Bearer token and a timeout', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const sender = new CloudApiWhatsAppSender(config, async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.x' }] }), { status: 200 });
    });
    await sender.sendText('+919999900201', 'hello');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://graph.facebook.com/v26.0/123456789012345/messages');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer EAAG-test-token');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ to: '919999900201', type: 'text' });
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it("surfaces Meta's error message and code, never the token", async () => {
    const sender = new CloudApiWhatsAppSender(config, async () =>
      new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token', code: 190 } }), { status: 401 }),
    );
    const err = await sender.sendText('+919999900201', 'hello').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect((err as WhatsAppSendError).status).toBe(401);
    expect((err as Error).message).toContain('Invalid OAuth access token (code 190)');
    expect((err as Error).message).not.toContain('EAAG-test-token');
  });

  it('a non-JSON failure still fails with the status', async () => {
    const sender = new CloudApiWhatsAppSender(config, async () => new Response('<html>502</html>', { status: 502 }));
    await expect(sender.sendButtons('+919999900201', 'x', [{ id: 'a', title: '1' }])).rejects.toThrow(/HTTP 502/);
  });
});

describe('StubWhatsAppSender', () => {
  it('in stub mode records the prompt for the simulator; in off mode refuses', async () => {
    const set = jest.fn(async () => 'OK');
    const redis = { set } as unknown as RedisService;
    const stub = new StubWhatsAppSender(redis, 'stub');
    await stub.sendButtons('+919999900201', 'Which number?', [{ id: 'a', title: '47' }]);
    expect(set).toHaveBeenCalledWith(devWaPromptKey('+919999900201'), expect.stringContaining('"title":"47"'), 'EX', 180);
    // The same limits as the real adapter — the stub must not pass what Meta would refuse.
    await expect(stub.sendButtons('+91', 'x', [{ id: 'a', title: 'x'.repeat(21) }])).rejects.toThrow(/1–20/);
    const off = new StubWhatsAppSender(redis, 'off');
    await expect(off.sendText('+919999900201', 'x')).rejects.toThrow(/switched off/);
  });
});
