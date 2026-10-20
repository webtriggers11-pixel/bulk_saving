import { ForbiddenException } from '@nestjs/common';
import type { RedisService } from '../../redis/redis.service';
import { DevOtpController } from './dev-otp.controller';

/** FEAT-026 V2 P3: the dev route answers this machine only. */
describe('DevOtpController', () => {
  const redis = { get: jest.fn(async () => '123456') } as unknown as RedisService;
  const controller = new DevOtpController(redis);

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('answers loopback %s', async (ip) => {
    await expect(controller.lastOtp(ip, '+919999900201')).resolves.toEqual({ code: '123456' });
  });

  it.each(['10.0.0.9', '192.168.1.20', '::ffff:192.168.1.20', ''])('refuses %j', async (ip) => {
    await expect(controller.lastOtp(ip, '+919999900201')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
