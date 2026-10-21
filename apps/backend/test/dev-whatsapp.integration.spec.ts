import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Society } from '@prisma/client';
import { whatsAppLoginMessage } from '@bulk/shared';
import { AppModule } from '../src/app.module';
import { APP_OPTIONS, configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { DevToolsModule } from '../src/modules/dev/dev-tools.module';
import { NOTIFICATION_CHANNEL } from '../src/modules/notifications/notification-channel';
import { WHATSAPP_SENDER } from '../src/modules/whatsapp/whatsapp-sender';
import { StubWhatsAppSender } from '../src/modules/whatsapp/stub-whatsapp.sender';
import { RedisService } from '../src/redis/redis.service';
import { CapturingChannel, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * FEAT-027 (ADR-0038 §6): the dev simulator plays WhatsApp against the SAME service the
 * signed webhook calls, with the stub sender recording the business's replies. The module
 * is mounted by hand (the suite pins OTP_DEV_LOG=false, so AppModule alone does not carry
 * it — `dev-tools.module.spec.ts` covers that decision); the sender is the real stub in
 * 'stub' mode. Needs Postgres + Redis.
 */
describe('Dev WhatsApp simulator (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let society: Society;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, DevToolsModule] })
      .overrideProvider(NOTIFICATION_CHANNEL)
      .useValue(new CapturingChannel())
      .overrideProvider(WHATSAPP_SENDER)
      .useFactory({ factory: (redis: RedisService) => new StubWhatsAppSender(redis, 'stub'), inject: [RedisService] })
      .compile();
    app = moduleRef.createNestApplication(APP_OPTIONS);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    society = await prisma.society.create({ data: { name: 'Green Meadows', city: 'Pune', inviteCode: randomInviteCode() } });
    const keys = await app.get(RedisService).keys('wa:start:*');
    if (keys.length) await app.get(RedisService).del(...keys);
  });

  afterAll(async () => {
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
  });

  it('inbound → prompt (three buttons) → tap → the browser collects tokens', async () => {
    const server = app.getHttpServer();
    const phone = randomPhone();
    const bare = phone.slice(3); // "98xxxxxxxx", typed the way a developer would
    const started = await request(server).post('/auth/wa/start').send({ inviteCode: society.inviteCode }).expect(200);
    const { requestId, code, matchNumber } = started.body.data;

    await request(server).post('/dev/whatsapp/inbound').send({ from: bare, text: whatsAppLoginMessage(code), name: 'Dev Tester' }).expect(200);
    const prompt = await request(server).get('/dev/whatsapp/prompt').query({ phone: bare }).expect(200);
    expect(prompt.body.data.body).toContain('Which number is on your screen');
    expect(prompt.body.data.buttons).toHaveLength(3);
    const right = prompt.body.data.buttons.find((b: { title: string }) => b.title === String(matchNumber));
    expect(right.id).toBe(`wa-login:${code}:${matchNumber}`);
    expect((await request(server).get(`/auth/wa/status/${requestId}`).expect(200)).body.data).toEqual({ status: 'awaiting_confirm' });

    await request(server).post('/dev/whatsapp/tap').send({ from: bare, buttonId: right.id }).expect(200);
    const after = await request(server).get('/dev/whatsapp/prompt').query({ phone: bare }).expect(200);
    expect(after.body.data.body).toContain("you're signed in");
    expect(after.body.data.buttons).toEqual([]);

    const confirmed = await request(server).get(`/auth/wa/status/${requestId}`).expect(200);
    expect(confirmed.body.data.status).toBe('confirmed');
    expect(confirmed.body.data.resident.phone).toBe(phone);
    expect(confirmed.body.data.resident.name).toBe('Dev Tester');
    expect(confirmed.body.data.resident.societyId).toBe(society.id);

    await request(server).get('/dev/whatsapp/prompt').query({ phone: randomPhone() }).expect(404);
    await request(server).get('/dev/whatsapp/prompt').query({ phone: 'abc' }).expect(400);
    await request(server).post('/dev/whatsapp/inbound').send({ from: 'abc', text: 'x' }).expect(400);
  });
});
