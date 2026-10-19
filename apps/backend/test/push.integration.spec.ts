import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { NotificationType, type Resident, type Society } from '@prisma/client';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PushGoneError } from '../src/modules/push/push-sender';
import { PUSH_QUEUE, pushJobId, PushService, type PushJobData } from '../src/modules/push/push.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CapturingChannel, CapturingPushSender, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Web push end to end (FEAT-020, ADR-0032), against real Postgres + Redis and the real
 * workers: subscribe over HTTP → an outbox notification is dispatched → the push worker
 * delivers it to every device of that resident, in that device's accent; a gone device is
 * pruned; tenancy and the SSRF allowlist hold.
 */
describe('Web push (FEAT-020)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let push: CapturingPushSender;
  let sms: CapturingChannel;
  let society: Society;
  let other: Society;
  let alice: Resident;
  let bob: Resident;
  let outsider: Resident;
  let aliceToken: string;
  let bobToken: string;
  let outsiderToken: string;

  const endpoint = (tag: string) => `https://fcm.googleapis.com/fcm/send/${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' };

  async function waitFor<T>(read: () => T | Promise<T>, ok: (v: T) => boolean, ms = 8_000): Promise<T> {
    const until = Date.now() + ms;
    for (;;) {
      const value = await read();
      if (ok(value) || Date.now() > until) return value;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async function notify(residentId: string, type: NotificationType = NotificationType.ROUND_CLOSED_MET) {
    const notifications = app.get(NotificationsService);
    const [id] = await prisma.$transaction((tx) =>
      notifications.stage(tx, [
        { residentId, roundId: null, type, dedupeKey: `PUSHTEST:${type}:${residentId}:${Math.random()}`, body: 'Your round is going ahead.' },
      ]),
    );
    await notifications.dispatch([id]);
    return id;
  }

  beforeAll(async () => {
    push = new CapturingPushSender();
    sms = new CapturingChannel();
    app = await createTestApp(sms, push);
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
    society = await prisma.society.create({ data: { name: 'Push Society', city: 'Pune', inviteCode: randomInviteCode() } });
    other = await prisma.society.create({ data: { name: 'Push Other', city: 'Pune', inviteCode: randomInviteCode() } });
    const mk = (societyId: string, name: string) =>
      prisma.resident.create({ data: { societyId, phone: randomPhone(), name, verifiedAt: new Date() } });
    alice = await mk(society.id, 'Alice');
    bob = await mk(society.id, 'Bob');
    outsider = await mk(other.id, 'Outsider');
    aliceToken = (await auth.issueTokens(alice)).accessToken;
    bobToken = (await auth.issueTokens(bob)).accessToken;
    outsiderToken = (await auth.issueTokens(outsider)).accessToken;
  });

  afterAll(async () => {
    await prisma.society.deleteMany({ where: { id: { in: [society.id, other.id] } } });
    await app.close();
  });

  beforeEach(() => {
    push.sent = [];
    push.failWith = null;
  });

  const subscribe = (token: string, body: object) =>
    request(app.getHttpServer()).post('/push/subscriptions').set('Authorization', `Bearer ${token}`).send(body);

  it('needs a signed-in resident', async () => {
    await request(app.getHttpServer()).get('/push/vapid-public-key').expect(401);
    const res = await request(app.getHttpServer())
      .get('/push/vapid-public-key')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(res.body.data.publicKey).toBe('BTestVapidPublicKey');
  });

  it.each([
    ['an internal URL (SSRF)', { endpoint: 'https://169.254.169.254/latest', keys, accent: 'mono' }],
    ['plain http', { endpoint: 'http://fcm.googleapis.com/fcm/send/x', keys, accent: 'mono' }],
    ['an unknown accent', { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys, accent: 'neon' }],
    ['missing keys', { endpoint: 'https://fcm.googleapis.com/fcm/send/x', accent: 'mono' }],
  ])('refuses %s', async (_why, body) => {
    const res = await subscribe(aliceToken, body).expect(400);
    expect(res.body.success).toBe(false);
  });

  it('subscribes with the resident and society from the token — never from the body', async () => {
    const e = endpoint('tenancy');
    // The global validation pipe strips fields a DTO does not declare, so a body that
    // names another resident and society is subscribed as the CALLER, in the caller's society.
    await subscribe(aliceToken, { endpoint: e, keys, accent: 'ocean', residentId: bob.id, societyId: other.id }).expect(200);
    const row = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: e } });
    expect(row).toMatchObject({ residentId: alice.id, societyId: society.id, accent: 'ocean' });
  });

  it('delivers an outbox notification to every device of that resident, each in its own accent', async () => {
    const phone = endpoint('alice-phone');
    const laptop = endpoint('alice-laptop');
    await subscribe(aliceToken, { endpoint: phone, keys, accent: 'sunset' }).expect(200);
    await subscribe(aliceToken, { endpoint: laptop, keys, accent: 'mono' }).expect(200);
    const bobs = endpoint('bob');
    await subscribe(bobToken, { endpoint: bobs, keys, accent: 'aurora' }).expect(200);

    await notify(alice.id);
    await waitFor(() => push.sent.length, (n) => n >= 2);
    expect(push.to(phone)).toEqual([expect.objectContaining({ title: expect.stringMatching(/going ahead/), accent: 'sunset', url: '/my-requests' })]);
    expect(push.to(laptop)).toEqual([expect.objectContaining({ accent: 'mono', icon: '/push/icon-mono.png' })]);
    expect(push.to(bobs)).toEqual([]);
    // Push rides beside SMS, never instead of it — and a push fault cannot block the SMS
    // (an invalid job id once failed the whole outbox job; see pushJobId).
    await waitFor(() => sms.messagesTo(alice.phone).length, (n) => n >= 1);
    expect(sms.messagesTo(alice.phone)).toContain('Your round is going ahead.');
  });

  it('a retried fan-out queues nothing twice (job id = notification × device)', async () => {
    const e = endpoint('idem');
    await subscribe(bobToken, { endpoint: e, keys, accent: 'mono' }).expect(200);
    const id = await notify(bob.id);
    const service = app.get(PushService);
    await service.fanOut({ id, residentId: bob.id });
    await service.fanOut({ id, residentId: bob.id });
    const device = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: e } });
    const queue = app.get<Queue<PushJobData>>(getQueueToken(PUSH_QUEUE));
    expect(await queue.getJob(pushJobId(id, device.id))).toBeDefined();
    await waitFor(() => push.to(e).length, (n) => n >= 1);
    await new Promise((r) => setTimeout(r, 500));
    expect(push.to(e)).toHaveLength(1);

    // V2 P1: the completed job is evicted (a burst of 1,000+ others would do it) and the
    // dispatch retries during an SMS outage — the row claim still stops a second push.
    await (await queue.getJob(pushJobId(id, device.id)))?.remove();
    expect(await service.fanOut({ id, residentId: bob.id })).toBe(0);
    expect(await queue.getJob(pushJobId(id, device.id))).toBeUndefined();
    await new Promise((r) => setTimeout(r, 300));
    expect(push.to(e)).toHaveLength(1);
  });

  it('a push fan-out fault never holds the SMS back (V2 P2)', async () => {
    const service = app.get(PushService);
    const spy = jest.spyOn(service, 'fanOut').mockRejectedValueOnce(new Error('redis hiccup'));
    await notify(alice.id);
    await waitFor(() => sms.messagesTo(alice.phone).length, (n) => n >= 1);
    expect(sms.messagesTo(alice.phone)).toContain('Your round is going ahead.');
    spy.mockRestore();
  });

  it('stores the endpoint normalised — the URL validated is the URL sent to (V2 P3)', async () => {
    const raw = `https://FCM.googleapis.com/fcm/send/norm-${Date.now()}`;
    await subscribe(bobToken, { endpoint: raw, keys, accent: 'mono' }).expect(200);
    const row = await prisma.pushSubscription.findFirst({ where: { residentId: bob.id, endpoint: { contains: 'norm-' } } });
    expect(row?.endpoint).toBe(raw.replace('FCM.googleapis.com', 'fcm.googleapis.com'));
  });

  it('a device the push service says is gone is removed', async () => {
    const e = endpoint('gone');
    await subscribe(bobToken, { endpoint: e, keys, accent: 'mono' }).expect(200);
    push.failWith = new PushGoneError(410);
    await notify(bob.id);
    const row = await waitFor(
      () => prisma.pushSubscription.findUnique({ where: { endpoint: e } }),
      (r) => r === null,
    );
    expect(row).toBeNull();
  });

  it('unsubscribing forgets only your own device — another resident cannot remove it', async () => {
    const e = endpoint('mine');
    await subscribe(aliceToken, { endpoint: e, keys, accent: 'mono' }).expect(200);
    await request(app.getHttpServer())
      .delete('/push/subscriptions')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ endpoint: e })
      .expect(200);
    expect(await prisma.pushSubscription.findUnique({ where: { endpoint: e } })).not.toBeNull();
    await request(app.getHttpServer())
      .delete('/push/subscriptions')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ endpoint: e })
      .expect(200);
    expect(await prisma.pushSubscription.findUnique({ where: { endpoint: e } })).toBeNull();
  });
});
