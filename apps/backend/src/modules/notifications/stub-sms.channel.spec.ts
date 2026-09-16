import { Logger } from '@nestjs/common';
import { redactPhone } from './notification-channel';
import { StubSmsChannel } from './stub-sms.channel';

describe('redactPhone', () => {
  it('masks everything but the last 4 digits, keeping a leading +', () => {
    expect(redactPhone('+919812345678')).toBe('+XXXXXXXX5678');
    expect(redactPhone('9812345678')).toBe('XXXXXX5678');
  });

  it('does not blow up on short input', () => {
    expect(redactPhone('123')).toBe('123');
  });
});

describe('StubSmsChannel', () => {
  const OLD_ENV = process.env.OTP_DEV_LOG;

  afterEach(() => {
    process.env.OTP_DEV_LOG = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('logs a redacted line and NEVER the raw code by default', async () => {
    delete process.env.OTP_DEV_LOG;
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    const channel = new StubSmsChannel();
    await channel.sendOtp('+919812345678', '123456');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = logSpy.mock.calls[0][0] as string;
    expect(logged).toContain('+XXXXXXXX5678');
    expect(logged).not.toContain('123456');
    // No DEV-only debug leak when the flag is unset.
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('only prints the raw code behind the explicit DEV flag', async () => {
    process.env.OTP_DEV_LOG = 'true';
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    const channel = new StubSmsChannel();
    await channel.sendOtp('+919812345678', '654321');

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0][0] as string).toContain('654321');
  });

  it('generic send redacts the recipient', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const channel = new StubSmsChannel();
    await channel.send('+919812345678', 'hello');
    expect(logSpy.mock.calls[0][0] as string).toContain('+XXXXXXXX5678');
  });
});
