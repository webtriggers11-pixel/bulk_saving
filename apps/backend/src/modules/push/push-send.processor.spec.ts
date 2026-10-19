import type { Job } from 'bullmq';
import { PushSendProcessor } from './push-send.processor';
import { PushGoneError, type PushSender } from './push-sender';
import type { PushJobData, PushService } from './push.service';

const device = { id: 'd1', endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: 'k', auth: 'a', accent: 'aurora' };
const notification = { id: 'n1', type: 'ROUND_CLOSED_MET', body: 'Going ahead.', roundId: 'r1' };

function setup(send: PushSender['send'], overrides: Partial<Record<keyof PushService, unknown>> = {}) {
  const push = {
    findDevice: jest.fn().mockResolvedValue(device),
    findNotification: jest.fn().mockResolvedValue(notification),
    forget: jest.fn(),
    recordSuccess: jest.fn(),
    recordFinalFailure: jest.fn(),
    ...overrides,
  };
  const sender: PushSender = { enabled: true, publicKey: 'pk', send: jest.fn(send) };
  const processor = new PushSendProcessor(push as unknown as PushService, sender);
  const job = (attemptsMade: number) =>
    ({ data: { notificationId: 'n1', subscriptionId: 'd1' }, attemptsMade, opts: { attempts: 5 } }) as Job<PushJobData>;
  return { push, sender, processor, job };
}

describe('PushSendProcessor (FEAT-020)', () => {
  it('sends the event payload in the device accent, and resets its failure streak', async () => {
    const { push, sender, processor, job } = setup(async () => undefined);
    await expect(processor.process(job(0))).resolves.toBe('sent');
    const payload = JSON.parse((sender.send as jest.Mock).mock.calls[0][1]);
    expect(payload).toMatchObject({ body: 'Going ahead.', accent: 'aurora', tag: 'round:r1', url: '/my-requests' });
    expect(push.recordSuccess).toHaveBeenCalledWith('d1');
  });

  it('a device the push service says is gone (410) is deleted, and the job is NOT retried', async () => {
    const { push, processor, job } = setup(async () => {
      throw new PushGoneError(410);
    });
    await expect(processor.process(job(0))).resolves.toBe('device-gone');
    expect(push.forget).toHaveBeenCalledWith('d1');
  });

  it('any other failure is retried — and only the FINAL attempt counts toward pruning', async () => {
    const { push, processor, job } = setup(async () => {
      throw new Error('push send failed (503)');
    });
    await expect(processor.process(job(0))).rejects.toThrow('503');
    expect(push.recordFinalFailure).not.toHaveBeenCalled();
    await expect(processor.process(job(4))).rejects.toThrow('503');
    expect(push.recordFinalFailure).toHaveBeenCalledWith('d1');
  });

  it('a device pruned or a notification deleted since fan-out is a quiet no-op', async () => {
    const gone = setup(async () => undefined, { findDevice: jest.fn().mockResolvedValue(null) });
    await expect(gone.processor.process(gone.job(0))).resolves.toBe('no-device');
    expect(gone.sender.send).not.toHaveBeenCalled();
  });

  it('a stored endpoint off the allowlist is never called — it is removed (V2 P3)', async () => {
    const { push, sender, processor, job } = setup(async () => undefined, {
      findDevice: jest.fn().mockResolvedValue({ ...device, endpoint: 'https://169.254.169.254/latest' }),
    });
    await expect(processor.process(job(0))).resolves.toBe('device-gone');
    expect(sender.send).not.toHaveBeenCalled();
    expect(push.forget).toHaveBeenCalledWith('d1');
  });

  it('an unknown stored accent falls back to Mono', async () => {
    const { sender, processor, job } = setup(async () => undefined, {
      findDevice: jest.fn().mockResolvedValue({ ...device, accent: 'neon' }),
    });
    await processor.process(job(0));
    expect(JSON.parse((sender.send as jest.Mock).mock.calls[0][1]).accent).toBe('mono');
  });
});
