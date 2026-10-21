import { ForbiddenException } from '@nestjs/common';
import type { RedisService } from '../../redis/redis.service';
import type { WaLoginService } from '../auth/wa-login.service';
import { DevWhatsAppController } from './dev-whatsapp.controller';

/** FEAT-027: the simulator answers this machine only, like the dev OTP route (FEAT-026 V2 P3). */
describe('DevWhatsAppController', () => {
  const wa = { handleInbound: jest.fn(async () => undefined) } as unknown as WaLoginService;
  const redis = { get: jest.fn(async () => JSON.stringify({ body: 'x', buttons: [], at: 'now' })) } as unknown as RedisService;
  const controller = new DevWhatsAppController(wa, redis);
  const from = (remoteAddress: string | undefined) => ({ socket: { remoteAddress } }) as unknown as Parameters<typeof controller.prompt>[0];

  it('answers loopback, and hands the service a wa_id (digits, no +) with the text', async () => {
    await expect(controller.prompt(from('127.0.0.1'), '+919999900201')).resolves.toEqual({ body: 'x', buttons: [], at: 'now' });
    await controller.inbound(from('::1'), { from: '99999 00201', text: 'My Bulk Saving login code is BS-ABCDEF', name: 'Dev' });
    expect(wa.handleInbound).toHaveBeenCalledWith(expect.objectContaining({ kind: 'text', from: '919999900201', profileName: 'Dev' }));
  });

  it.each(['10.0.0.9', '::ffff:192.168.1.20', undefined])('refuses %j', async (ip) => {
    await expect(controller.prompt(from(ip), '+919999900201')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.tap(from(ip), { from: '+919999900201', buttonId: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
