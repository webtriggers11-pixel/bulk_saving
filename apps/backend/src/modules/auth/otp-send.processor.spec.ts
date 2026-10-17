import type { Job } from 'bullmq';
import type { Resident } from '@prisma/client';
import type { NotificationChannel } from '../notifications/notification-channel';
import type { ResidentsService } from '../residents/residents.service';
import { sealOtp } from './otp-seal';
import { OtpSendProcessor, type OtpSendJobData } from './otp-send.processor';

/**
 * CHORE-017: the admin door enqueues a send for EVERY caller and the worker decides,
 * so the request path does identical work for an administrator and a stranger. These
 * are the worker's decisions; the V2-round-3 provider failures (a synchronous throw, an
 * error that echoes the code) now land here instead of in the request process.
 */
describe('OtpSendProcessor', () => {
  const OLD = process.env.OTP_HASH_SECRET;
  beforeAll(() => {
    process.env.OTP_HASH_SECRET = 'test-secret-for-sealing';
  });
  afterAll(() => {
    process.env.OTP_HASH_SECRET = OLD;
  });

  function setup(isAdmin: boolean, sendOtp: NotificationChannel['sendOtp'] = async () => {}) {
    const sent: Array<{ phone: string; code: string }> = [];
    const channel = {
      sendOtp: async (phone: string, code: string) => {
        await sendOtp(phone, code);
        sent.push({ phone, code });
      },
      send: async () => {},
    } as NotificationChannel;
    const residents = {
      findAdminByPhone: async () => (isAdmin ? ({ id: 'r1' } as Resident) : null),
    } as unknown as ResidentsService;
    const processor = new OtpSendProcessor(residents, channel);
    const job = (code: string) =>
      ({ data: { door: 'admin', phone: '+919800000001', sealed: sealOtp(code) } }) as Job<OtpSendJobData>;
    return { processor, job, sent };
  }

  it('sends the unsealed code to an administrator', async () => {
    const { processor, job, sent } = setup(true);
    await expect(processor.process(job('481516'))).resolves.toBeUndefined();
    expect(sent).toEqual([{ phone: '+919800000001', code: '481516' }]);
  });

  it('sends nothing to a number that is not an administrator — the decision the request no longer makes', async () => {
    const { processor, job, sent } = setup(false);
    await expect(processor.process(job('481516'))).resolves.toBeUndefined();
    expect(sent).toEqual([]);
  });

  it('turns a SYNCHRONOUS provider throw into a retryable failure (V2 round 3, now off the request path)', async () => {
    const { processor, job } = setup(true, () => {
      throw new Error('malformed provider URL');
    });
    await expect(processor.process(job('481516'))).rejects.toThrow('malformed provider URL');
  });

  it('returns nothing for the events stream to keep — a stored {sent} would mark admin numbers', async () => {
    const admin = setup(true);
    const stranger = setup(false);
    expect(await admin.processor.process(admin.job('1'))).toEqual(await stranger.processor.process(stranger.job('1')));
  });

  it('keeps the code out of the failure BullMQ stores, even if the provider echoes it', async () => {
    const { processor, job } = setup(true, async (_phone, code) => {
      throw new Error(`rejected body {"text":"Your code is ${code}"}`);
    });
    const error = await processor.process(job('481516')).catch((err: Error) => err);
    expect(String((error as Error).message)).not.toContain('481516');
    expect(String((error as Error).message)).toContain('******');
  });
});
