import { isKnownPushEndpoint, redactEndpoint } from './push-sender';

/** FEAT-020 (ADR-0032): the server POSTs to subscribed endpoints, so only push services pass. */
describe('isKnownPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGx1',
    'https://api.push.apple.com/3/device/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
  ])('accepts %s', (endpoint) => {
    expect(isKnownPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ['plain http', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['an internal host', 'https://169.254.169.254/latest/meta-data'],
    ['localhost', 'https://localhost:3000/admin'],
    ['a look-alike suffix', 'https://fcm.googleapis.com.evil.example/x'],
    ['a look-alike prefix', 'https://evilpush.apple.com.attacker.io/x'],
    ['credentials in the URL', 'https://user:pass@fcm.googleapis.com/x'],
    ['a non-default port', 'https://fcm.googleapis.com:8443/x'],
    ['not a URL', 'fcm.googleapis.com/x'],
    ['a parser-confusing host', 'https://;x.push.apple.com/'],
  ])('refuses %s', (_why, endpoint) => {
    expect(isKnownPushEndpoint(endpoint)).toBe(false);
  });
});

describe('redactEndpoint', () => {
  it('keeps only the push service host and a short suffix', () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/SECRETPARTabcdef';
    expect(redactEndpoint(endpoint)).toBe('fcm.googleapis.com/…abcdef');
    expect(redactEndpoint(endpoint)).not.toContain('SECRETPART');
  });
});
