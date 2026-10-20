import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Society } from '@prisma/client';
import { whatsAppLoginMessage } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ErrorCode } from '../src/common/error-codes';
import { signMetaBody } from '../src/modules/auth/wa-webhook.signature';
import { WA_START_CLIENT_HOURLY_MAX } from '../src/modules/auth/wa-login.service';
import { CapturingChannel, CapturingWhatsAppSender, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

const ENV = {
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_ACCESS_TOKEN: 'EAAG-a-long-enough-test-token',
  WHATSAPP_APP_SECRET: 'an-app-secret-0123456789',
  WHATSAPP_VERIFY_TOKEN: 'a-verify-token-0123456789',
  WHATSAPP_BUSINESS_NUMBER: '919876543210',
};

/** The documented Cloud API webhook envelope, signed the way Meta signs it. */
function envelope(messages: unknown[], contact?: { waId: string; name: string }) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1234567890',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: ENV.WHATSAPP_BUSINESS_NUMBER, phone_number_id: ENV.WHATSAPP_PHONE_NUMBER_ID },
              contacts: contact ? [{ profile: { name: contact.name }, wa_id: contact.waId }] : [],
              messages,
            },
          },
        ],
      },
    ],
  };
}
// Meta's message ids are globally unique; so are these — across RUNS too, since the dedupe
// key lives in Redis for ten minutes and a repeated id would be (correctly) ignored.
const RUN = Math.random().toString(36).slice(2, 8);
let messageSeq = 0;
const lastMessageId = () => `wamid.${RUN}.${messageSeq}`;
const textMessage = (from: string, text: string, name = 'Asha Rao', id = `wamid.${RUN}.${++messageSeq}`) =>
  envelope([{ from, id, timestamp: '1729400000', type: 'text', text: { body: text } }], { waId: from, name });
const buttonReply = (from: string, buttonId: string, id = `wamid.${RUN}.${++messageSeq}`) =>
  envelope([
    { from, id, timestamp: '1729400010', type: 'interactive', context: { id: 'wamid.prompt' }, interactive: { type: 'button_reply', button_reply: { id: buttonId, title: buttonId.split(':').pop() } } },
  ]);

/**
 * FEAT-027 (ADR-0038): the whole "Tap to verify" flow over HTTP, with the WhatsApp side
 * arriving as SIGNED webhook payloads in the exact Cloud API shapes and a capturing sender
 * standing in for Meta's messages endpoint. Needs Postgres + Redis.
 */
describe('Sign in with WhatsApp (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let sender: CapturingWhatsAppSender;
  let society: Society;
  const saved: Record<string, string | undefined> = {};

  const server = () => app.getHttpServer();
  const webhook = (body: unknown, secret = ENV.WHATSAPP_APP_SECRET) => {
    const raw = JSON.stringify(body);
    return request(server()).post('/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', signMetaBody(raw, secret)).send(raw);
  };
  const start = (inviteCode = society.inviteCode) => request(server()).post('/auth/wa/start').set('User-Agent', 'Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile Safari/537.36').send({ inviteCode });
  const status = (requestId: string) => request(server()).get(`/auth/wa/status/${requestId}`);
  const waId = (phone: string) => phone.replace(/^\+/, '');
  /** The budget counters for this client, so one test cannot spend another's (and no run spends the next run's). */
  const clearBudgets = async () => {
    const keys = await redis.keys('wa:start:*');
    if (keys.length) await redis.del(...keys);
  };

  beforeAll(async () => {
    for (const [key, value] of Object.entries(ENV)) {
      saved[key] = process.env[key];
      process.env[key] = value;
    }
    sender = new CapturingWhatsAppSender('cloud');
    app = await createTestApp(new CapturingChannel(), undefined, sender);
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    society = await prisma.society.create({ data: { name: 'Blue Waters', city: 'Pune', inviteCode: randomInviteCode() } });
    await clearBudgets();
  });

  beforeEach(async () => {
    sender.sent = [];
    await clearBudgets();
  });

  afterAll(async () => {
    await clearBudgets();
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
    for (const key of Object.keys(ENV)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('offers the method, and the handshake echoes the challenge only for the right verify token', async () => {
    const methods = await request(server()).get('/auth/methods').expect(200);
    expect(methods.body).toEqual({ success: true, data: { whatsapp: true } });
    const ok = await request(server()).get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': ENV.WHATSAPP_VERIFY_TOKEN, 'hub.challenge': '1158201444' }).expect(200);
    expect(ok.text).toBe('1158201444');
    expect(ok.headers['content-type']).toMatch(/text\/plain/);
    await request(server()).get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '1' }).expect(403);
  });

  it('resident door: start → message → number-match prompt → right tap → tokens, once', async () => {
    const phone = randomPhone();
    const started = await start().expect(200);
    const { requestId, code, waLink, matchNumber, expiresAt } = started.body.data;
    expect(requestId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(code).toMatch(/^BS-[A-HJ-NP-Z2-9]{6}$/);
    expect(matchNumber).toBeGreaterThanOrEqual(10);
    expect(matchNumber).toBeLessThanOrEqual(99);
    expect(waLink).toBe(`https://wa.me/${ENV.WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(whatsAppLoginMessage(code))}`);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 150_000);
    // The response carries no phone and no society: nothing the browser did not already know.
    expect(JSON.stringify(started.body)).not.toContain(society.id);

    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'pending' });

    await webhook(textMessage(waId(phone), whatsAppLoginMessage(code))).expect(200);
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'awaiting_confirm' });
    const prompts = sender.to(phone);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].body).toContain('Signing in to Bulk Saving on Chrome · Android');
    expect(prompts[0].body).toContain('Which number is on your screen');
    expect(prompts[0].buttons).toHaveLength(3);
    expect(prompts[0].buttons.map((b) => b.title)).toContain(String(matchNumber));
    expect(new Set(prompts[0].buttons.map((b) => b.title)).size).toBe(3);
    for (const b of prompts[0].buttons) {
      expect(b.id).toBe(`wa-login:${code}:${b.title}`);
      expect(b.id).not.toContain(requestId);
    }

    // A second copy of the same message (Meta redelivery) changes nothing and sends nothing.
    await webhook(textMessage(waId(phone), whatsAppLoginMessage(code), 'Asha Rao', lastMessageId())).expect(200);
    expect(sender.to(phone)).toHaveLength(1);

    await webhook(buttonReply(waId(phone), `wa-login:${code}:${matchNumber}`)).expect(200);
    const confirmed = await status(requestId).expect(200);
    expect(confirmed.body.data.status).toBe('confirmed');
    const { accessToken, refreshToken, resident } = confirmed.body.data;
    expect(typeof accessToken).toBe('string');
    expect(typeof refreshToken).toBe('string');
    expect(resident.societyId).toBe(society.id);
    expect(resident.phone).toBe(phone);
    expect(resident.name).toBe('Asha Rao'); // the WhatsApp profile name, for a NEW resident
    expect(resident.verifiedAt).not.toBeNull();
    expect(sender.to(phone).at(-1)?.body).toContain("you're signed in");

    // The same tokens as the OTP doors: they work, and the session rotates.
    const me = await request(server()).get('/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(me.body.data.resident.id).toBe(resident.id);
    await request(server()).post('/auth/refresh').send({ refreshToken }).expect(200);

    // Tokens are issued ONCE: the record is consumed.
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'expired' });
    // A late tap on a consumed request is ignored, silently.
    const before = sender.sent.length;
    await webhook(buttonReply(waId(phone), `wa-login:${code}:${matchNumber}`)).expect(200);
    expect(sender.sent.length).toBe(before);
  });

  it('an existing resident keeps their chosen name', async () => {
    const phone = randomPhone();
    await prisma.resident.create({ data: { societyId: society.id, phone, name: 'Priya' } });
    const { requestId, code, matchNumber } = (await start().expect(200)).body.data;
    await webhook(textMessage(waId(phone), whatsAppLoginMessage(code), 'WhatsApp Name')).expect(200);
    await webhook(buttonReply(waId(phone), `wa-login:${code}:${matchNumber}`)).expect(200);
    const confirmed = await status(requestId).expect(200);
    expect(confirmed.body.data.resident.name).toBe('Priya');
  });

  it('the wrong button denies for good; a later right tap, or a tap from another number, is ignored', async () => {
    const phone = randomPhone();
    const { requestId, code, matchNumber } = (await start().expect(200)).body.data;
    await webhook(textMessage(waId(phone), `Hi! ${whatsAppLoginMessage(code).toLowerCase()}`)).expect(200);
    const other = sender.to(phone)[0].buttons.map((b) => b.title).find((t) => t !== String(matchNumber)) as string;

    // A tap from a number that did not send the message: nothing.
    await webhook(buttonReply(waId(randomPhone()), `wa-login:${code}:${matchNumber}`)).expect(200);
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'awaiting_confirm' });

    await webhook(buttonReply(waId(phone), `wa-login:${code}:${other}`)).expect(200);
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'denied', reason: 'WRONG_NUMBER' });
    expect(sender.to(phone).at(-1)?.body).toContain("wasn't the number on the screen");
    const sends = sender.sent.length;
    await webhook(buttonReply(waId(phone), `wa-login:${code}:${matchNumber}`)).expect(200);
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'denied', reason: 'WRONG_NUMBER' });
    expect(sender.sent.length).toBe(sends);
  });

  it('refuses an unsigned or mis-signed delivery, and never acts on it', async () => {
    const phone = randomPhone();
    const { requestId, code } = (await start().expect(200)).body.data;
    const body = textMessage(waId(phone), whatsAppLoginMessage(code));
    const bad = await webhook(body, 'another-secret-0123456789').expect(401);
    expect(bad.body.error.code).toBe(ErrorCode.WHATSAPP_WEBHOOK_SIGNATURE);
    await request(server()).post('/webhooks/whatsapp').send(body).expect(401);
    // Same bytes, signature of DIFFERENT bytes: refused.
    await request(server()).post('/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', signMetaBody('{}', ENV.WHATSAPP_APP_SECRET)).send(JSON.stringify(body)).expect(401);
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'pending' });
    expect(sender.sent).toHaveLength(0);
  });

  it('an unknown code, free text, a stale code and a foreign phone-number id get no reply at all', async () => {
    const phone = randomPhone();
    await webhook(textMessage(waId(phone), 'My Bulk Saving login code is BS-ZZZZZZ')).expect(200);
    await webhook(textMessage(waId(phone), 'hello?')).expect(200);
    const { requestId, code } = (await start().expect(200)).body.data;
    await redis.del(`wa:code:${code}`, `wa:req:${requestId}`); // aged out
    await webhook(textMessage(waId(phone), whatsAppLoginMessage(code))).expect(200);
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'expired' });
    const foreign = textMessage(waId(phone), whatsAppLoginMessage(code));
    (foreign.entry[0].changes[0].value.metadata as { phone_number_id: string }).phone_number_id = '999';
    await webhook(foreign).expect(200);
    expect(sender.sent).toHaveLength(0);
  });

  it('unknown and malformed request ids answer alike', async () => {
    expect((await status('A'.repeat(43)).expect(200)).body.data).toEqual({ status: 'expired' });
    expect((await status('not-a-request-id').expect(200)).body.data).toEqual({ status: 'expired' });
  });

  it('a failed prompt puts the request back to pending and lets Meta redeliver', async () => {
    const phone = randomPhone();
    const { requestId, code } = (await start().expect(200)).body.data;
    sender.failNext = new Error('Cloud API answered 500');
    const body = textMessage(waId(phone), whatsAppLoginMessage(code));
    await webhook(body).expect(500);
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'pending' });
    await webhook(body).expect(200); // the SAME message id — redelivery is processed
    expect((await status(requestId).expect(200)).body.data).toEqual({ status: 'awaiting_confirm' });
  });

  it('admin door: the WhatsApp side is identical for everyone; the role is decided at token time', async () => {
    const adminPhone = randomPhone();
    const strangerPhone = randomPhone();
    await prisma.resident.create({ data: { societyId: society.id, phone: adminPhone, name: 'Ops', role: 'SUPER_ADMIN' } });
    const startAdmin = () => request(server()).post('/auth/admin/wa/start').set('User-Agent', 'Mozilla/5.0 (Macintosh) Chrome/129.0 Safari/537.36').send({});

    const a = (await startAdmin().expect(200)).body.data;
    const s = (await startAdmin().expect(200)).body.data;
    await webhook(textMessage(waId(adminPhone), whatsAppLoginMessage(a.code), 'Ops')).expect(200);
    await webhook(textMessage(waId(strangerPhone), whatsAppLoginMessage(s.code), 'Someone')).expect(200);
    const [toAdmin] = sender.to(adminPhone);
    const [toStranger] = sender.to(strangerPhone);
    expect(toAdmin.body).toBe(toStranger.body);
    expect(toAdmin.buttons).toHaveLength(3);
    expect(toStranger.buttons).toHaveLength(3);

    await webhook(buttonReply(waId(strangerPhone), `wa-login:${s.code}:${s.matchNumber}`)).expect(200);
    await webhook(buttonReply(waId(adminPhone), `wa-login:${a.code}:${a.matchNumber}`)).expect(200);
    // Both numbers' owners read the same confirmation.
    expect(sender.to(strangerPhone).at(-1)?.body).toBe(sender.to(adminPhone).at(-1)?.body);

    expect((await status(s.requestId).expect(200)).body.data).toEqual({ status: 'denied', reason: 'NOT_AN_ADMIN' });
    expect((await status(s.requestId).expect(200)).body.data).toEqual({ status: 'denied', reason: 'NOT_AN_ADMIN' });
    const admin = await status(a.requestId).expect(200);
    expect(admin.body.data.status).toBe('confirmed');
    expect(admin.body.data.resident.role).toBe('SUPER_ADMIN');
    expect(admin.body.data.resident.phone).toBe(adminPhone);
    const dash = await request(server()).get('/me').set('Authorization', `Bearer ${admin.body.data.accessToken}`).expect(200);
    expect(dash.body.data.resident.role).toBe('SUPER_ADMIN');
    // The admin door created nothing for the stranger.
    expect(await prisma.resident.count({ where: { phone: strangerPhone } })).toBe(0);
  });

  it('an unknown invite code starts nothing; a client gets a budget of starts per hour', async () => {
    const bad = await start('NOPE0000').expect(400);
    expect(bad.body.error.code).toBe(ErrorCode.INVALID_INVITE_CODE);
    for (let i = 0; i < WA_START_CLIENT_HOURLY_MAX; i += 1) await start().expect(200);
    const limited = await start().expect(429);
    expect(limited.body.error.code).toBe(ErrorCode.OTP_RATE_LIMITED);
  });
});

describe('Sign in with WhatsApp — switched off (the suite default: no Meta app, no dev echo)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
  });
  afterAll(async () => {
    await app.close();
  });

  it('is not offered, the start routes say so, and the webhook does not exist', async () => {
    const methods = await request(app.getHttpServer()).get('/auth/methods').expect(200);
    expect(methods.body.data).toEqual({ whatsapp: false });
    const started = await request(app.getHttpServer()).post('/auth/wa/start').send({ inviteCode: 'ABCD1234' });
    // Invite-code check first (as the OTP door does), then the method: use a real-looking code
    // and accept either refusal shape — the point is that nothing starts.
    expect([400, 404]).toContain(started.status);
    const admin = await request(app.getHttpServer()).post('/auth/admin/wa/start').send({}).expect(404);
    expect(admin.body.error.code).toBe(ErrorCode.WHATSAPP_LOGIN_DISABLED);
    await request(app.getHttpServer()).get('/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'x', 'hub.challenge': '1' }).expect(404);
    await request(app.getHttpServer()).post('/webhooks/whatsapp').send({ object: 'whatsapp_business_account', entry: [] }).expect(404);
  });
});
