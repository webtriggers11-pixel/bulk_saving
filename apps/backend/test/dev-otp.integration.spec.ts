import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/bootstrap';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/redis/redis.service';
import { DevToolsModule } from '../src/modules/dev/dev-tools.module';
import { devOtpKey } from '../src/modules/notifications/stub-sms.channel';
import { CapturingChannel, createTestApp, randomPhone } from './helpers/test-app';

/**
 * FEAT-026 (ADR-0037): the dev OTP route answers from the stub channel's stash — and does
 * not exist where the dev echo is off. The import decision itself is a unit test
 * (`dev-tools.module.spec.ts`): AppModule computes it once at import, and `load-env.ts` pins
 * OTP_DEV_LOG=false for the suite, so the full app here is the "off" case and the "on" case
 * mounts the module directly.
 */
describe('GET /dev/otp (integration, needs Redis)', () => {
  it('with the module mounted: the stashed code for a phone in any spelling; 404 when none; 400 for garbage', async () => {
    // FEAT-027: DevToolsModule now imports AuthModule (for the WhatsApp simulator), so it is
    // mounted beside the whole app rather than beside RedisModule alone.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, DevToolsModule] }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    try {
      const phone = randomPhone(); // +91…
      const redis = app.get(RedisService);
      await redis.set(devOtpKey(phone), '4242', 'EX', 30);
      const bare = phone.replace(/^\+91/, '');
      const res = await request(app.getHttpServer()).get('/dev/otp').query({ phone: `${bare.slice(0, 5)} ${bare.slice(5)}` }).expect(200);
      expect(res.body).toEqual({ success: true, data: { code: '4242' } });
      await request(app.getHttpServer()).get('/dev/otp').query({ phone: randomPhone() }).expect(404);
      await request(app.getHttpServer()).get('/dev/otp').query({ phone: 'abc' }).expect(400);
      await request(app.getHttpServer()).get('/dev/otp').expect(400);
      // supertest connects over loopback and dev trusts no proxy header, so a spoofed
      // X-Forwarded-For changes nothing here; the non-loopback refusal is unit-tested.
      await request(app.getHttpServer()).get('/dev/otp').set('X-Forwarded-For', '10.0.0.9').query({ phone }).expect(200);
      await redis.del(devOtpKey(phone));
    } finally {
      await app.close();
    }
  });

  it('in the full app with the echo off (the suite default): the route does not exist', async () => {
    const app = await createTestApp(new CapturingChannel());
    try {
      const phone = randomPhone();
      await app.get(RedisService).set(devOtpKey(phone), '4242', 'EX', 30);
      await request(app.getHttpServer()).get('/dev/otp').query({ phone }).expect(404);
      await app.get(RedisService).del(devOtpKey(phone));
    } finally {
      await app.close();
    }
  });
});
