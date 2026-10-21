import { describeDevice } from './wa-device';
import { parseWebhookEvents } from './wa-webhook.parser';
import { signMetaBody, verifyMetaSignature } from './wa-webhook.signature';
import { WA_CODE_ALPHABET, WA_CODE_PATTERN } from './wa-login.service';

/** FEAT-027 (ADR-0038): the pure pieces of the WhatsApp sign-in. */
describe('describeDevice', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36', 'Chrome · Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Safari · iPhone'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1', 'Chrome · iPhone'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0', 'Edge · Mac'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0', 'Firefox · Windows'],
    ['Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36', 'Samsung Internet · Android'],
    ['curl/8.4.0', 'a browser'],
    [undefined, 'a browser'],
  ])('%s → %s', (ua, expected) => {
    expect(describeDevice(ua)).toBe(expected);
  });
});

describe('WA_CODE_PATTERN', () => {
  it('finds the code inside the pre-filled message, in any case, with or without the dash', () => {
    expect(WA_CODE_PATTERN.exec('My Bulk Saving login code is BS-7KQ2MX')?.[1]).toBe('7KQ2MX');
    expect(WA_CODE_PATTERN.exec('bs-7kq2mx')?.[1]).toBe('7kq2mx');
    expect(WA_CODE_PATTERN.exec('code BS 7KQ2MX please')?.[1]).toBe('7KQ2MX');
    expect(WA_CODE_PATTERN.exec('BS-7KQ2MXY')).toBeNull(); // too long: not a word boundary
    expect(WA_CODE_PATTERN.exec('BS-7KQ20X')).toBeNull(); // 0 is not in the alphabet
    expect(WA_CODE_PATTERN.exec('hello')).toBeNull();
  });
  it('the alphabet has no 0/O/1/I and 32 symbols', () => {
    expect(WA_CODE_ALPHABET).toHaveLength(32);
    for (const c of '0O1I') expect(WA_CODE_ALPHABET).not.toContain(c);
  });
});

describe('verifyMetaSignature', () => {
  const secret = 'an-app-secret-0123456789';
  const body = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
  it('accepts the HMAC-SHA256 of the raw bytes, in either case', () => {
    const header = signMetaBody(body, secret);
    expect(header).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(verifyMetaSignature(body, header, secret)).toBe(true);
    expect(verifyMetaSignature(body, header.toUpperCase().replace('SHA256=', 'sha256='), secret)).toBe(true);
  });
  it('refuses a different body, secret, a missing or malformed header, or no raw body', () => {
    const header = signMetaBody(body, secret);
    expect(verifyMetaSignature(Buffer.from('{"object":"x"}'), header, secret)).toBe(false);
    expect(verifyMetaSignature(body, header, 'another-secret-0123456789')).toBe(false);
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(body, 'sha1=abc', secret)).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=nothex', secret)).toBe(false);
    expect(verifyMetaSignature(undefined, header, secret)).toBe(false);
  });
});

describe('parseWebhookEvents', () => {
  const envelope = (messages: unknown[], contacts: unknown[] = [{ profile: { name: 'Asha Rao' }, wa_id: '919999900201' }]) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1234567890',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '919876543210', phone_number_id: '123456789012345' },
              contacts,
              messages,
            },
          },
        ],
      },
    ],
  });

  it('reads a text message with the profile name and the phone-number id', () => {
    const events = parseWebhookEvents(
      envelope([{ from: '919999900201', id: 'wamid.1', timestamp: '1729400000', type: 'text', text: { body: 'My Bulk Saving login code is BS-7KQ2MX' } }]),
    );
    expect(events).toEqual([
      { kind: 'text', messageId: 'wamid.1', from: '919999900201', profileName: 'Asha Rao', text: 'My Bulk Saving login code is BS-7KQ2MX', phoneNumberId: '123456789012345' },
    ]);
  });

  it('reads a button reply', () => {
    const events = parseWebhookEvents(
      envelope([
        {
          from: '919999900201',
          id: 'wamid.2',
          timestamp: '1729400010',
          type: 'interactive',
          context: { from: '919876543210', id: 'wamid.prompt' },
          interactive: { type: 'button_reply', button_reply: { id: 'wa-login:BS-7KQ2MX:47', title: '47' } },
        },
      ]),
    );
    expect(events).toEqual([
      { kind: 'button', messageId: 'wamid.2', from: '919999900201', profileName: 'Asha Rao', buttonId: 'wa-login:BS-7KQ2MX:47', title: '47', phoneNumberId: '123456789012345' },
    ]);
  });

  it('skips statuses, media, list replies and malformed entries without dropping the rest', () => {
    const body = envelope([
      { from: '919999900201', id: 'wamid.3', type: 'image', image: { id: 'x' } },
      { from: '919999900201', id: 'wamid.4', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'a' } } },
      { from: '919999900201', type: 'text', text: { body: 'no id' } },
      { from: '919999900201', id: 'wamid.5', type: 'text', text: { body: 'ok' } },
    ]);
    (body.entry as unknown[]).push({ changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.x', status: 'delivered' }] } }] }, 'garbage');
    expect(parseWebhookEvents(body).map((e) => e.messageId)).toEqual(['wamid.5']);
    expect(parseWebhookEvents({ object: 'page', entry: [] })).toEqual([]);
    expect(parseWebhookEvents(null)).toEqual([]);
    expect(parseWebhookEvents('x')).toEqual([]);
  });
});
