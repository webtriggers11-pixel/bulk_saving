import { Logger } from '@nestjs/common';
import type { RedisService } from '../../redis/redis.service';
import { devOtpKey } from './stub-sms.channel';
import { maskOtp } from './notification-channel';
import { otpMessage, TextbeeSmsChannel } from './textbee-sms.channel';
import { DEFAULT_TEXTBEE_BASE_URL, textbeeConfig, type TextbeeConfig } from './textbee.config';

const config: TextbeeConfig = {
  apiKey: 'txb_test-key-0123456789',
  deviceId: 'dev0123456789',
  simSlotIndex: 1,
  baseUrl: 'https://api.textbee.dev/api/v1',
};

function redisStub() {
  const calls: unknown[][] = [];
  return { calls, set: (...args: unknown[]) => (calls.push(args), Promise.resolve('OK')) };
}

function okFetch(status = 200) {
  return jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status } as Response);
}

describe('TextbeeSmsChannel (FEAT-046)', () => {
  const OLD = { log: process.env.OTP_DEV_LOG, env: process.env.NODE_ENV };
  beforeEach(() => jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined));
  afterEach(() => {
    process.env.OTP_DEV_LOG = OLD.log;
    process.env.NODE_ENV = OLD.env;
    jest.restoreAllMocks();
  });

  it('POSTs the message to /gateway/send-sms with the api key, device, recipient and SIM slot', async () => {
    const fetchFn = okFetch();
    const redis = redisStub();
    await new TextbeeSmsChannel(config, redis as unknown as RedisService, fetchFn).send('+919812345678', 'hello');

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.textbee.dev/api/v1/gateway/send-sms');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-api-key': config.apiKey, 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      deviceId: config.deviceId,
      recipients: ['+919812345678'],
      message: 'hello',
      simSlotIndex: 1,
    });
    expect(init.signal).toBeDefined();
  });

  it('omits simSlotIndex when no slot is configured', async () => {
    const fetchFn = okFetch();
    await new TextbeeSmsChannel({ ...config, simSlotIndex: null }, redisStub() as unknown as RedisService, fetchFn).send('+919812345678', 'x');
    const body = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).not.toHaveProperty('simSlotIndex');
  });

  it('sends the OTP inside a short message and does not stash it when the dev echo is off', async () => {
    delete process.env.OTP_DEV_LOG;
    const fetchFn = okFetch();
    const redis = redisStub();
    await new TextbeeSmsChannel(config, redis as unknown as RedisService, fetchFn).sendOtp('+919812345678', '4821');
    const body = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.message).toBe(otpMessage('4821'));
    expect(body.message).toContain('4821');
    expect(redis.calls).toEqual([]);
  });

  it('words the OTP as the carrier-friendly sign-in prompt with the code split 3-3 (CHORE-028)', () => {
    expect(otpMessage('482913')).toBe('Hi, welcome to BulkSaving. Please enter 482-913 in the app to sign in.');
    expect(otpMessage('482913')).not.toMatch(/code|share/i);
    expect(otpMessage('4821')).toBe('Hi, welcome to BulkSaving. Please enter 4821 in the app to sign in.');
  });

  it('masks the code in both its bare and its SMS form (CHORE-028 V2 P3)', () => {
    expect(maskOtp('echo: Please enter 482-913 / 482913', '482913')).toBe('echo: Please enter ****** / ******');
  });

  it('stashes the OTP for the dev toast only when the dev echo is on', async () => {
    process.env.OTP_DEV_LOG = 'true';
    process.env.NODE_ENV = 'development';
    const redis = redisStub();
    await new TextbeeSmsChannel(config, redis as unknown as RedisService, okFetch()).sendOtp('+919812345678', '4821');
    expect(redis.calls).toEqual([[devOtpKey('+919812345678'), '4821', 'EX', 120]]);
  });

  it('throws on a non-2xx answer without leaking the message, code or full phone', async () => {
    const channel = new TextbeeSmsChannel(config, redisStub() as unknown as RedisService, okFetch(401));
    const err = await channel.sendOtp('+919812345678', '4821').catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/HTTP 401/);
    expect((err as Error).message).not.toContain('4821');
    expect((err as Error).message).not.toContain('9812345678');
  });

  it('throws on a network error or timeout', async () => {
    const fetchFn = jest.fn().mockRejectedValue(Object.assign(new Error('boom 4821'), { name: 'TimeoutError' }));
    const channel = new TextbeeSmsChannel(config, redisStub() as unknown as RedisService, fetchFn);
    const err = (await channel.sendOtp('+919812345678', '4821').catch((e: Error) => e)) as Error;
    expect(err.message).toMatch(/TimeoutError/);
    expect(err.message).not.toContain('4821');
  });
});

describe('textbeeConfig', () => {
  it('is null unless both the key and the device id are set', () => {
    expect(textbeeConfig({})).toBeNull();
    expect(textbeeConfig({ TEXTBEE_API_KEY: 'k' })).toBeNull();
    expect(textbeeConfig({ TEXTBEE_DEVICE_ID: 'd' })).toBeNull();
  });

  it('reads the slot and base URL, defaulting and trimming the trailing slash', () => {
    expect(textbeeConfig({ TEXTBEE_API_KEY: ' k ', TEXTBEE_DEVICE_ID: 'd' })).toEqual({
      apiKey: 'k', deviceId: 'd', simSlotIndex: null, baseUrl: DEFAULT_TEXTBEE_BASE_URL,
    });
    expect(textbeeConfig({ TEXTBEE_API_KEY: 'k', TEXTBEE_DEVICE_ID: 'd', TEXTBEE_SIM_SLOT: '0', TEXTBEE_BASE_URL: 'https://x.test/api/' })).toMatchObject({
      simSlotIndex: 0, baseUrl: 'https://x.test/api',
    });
  });
});
