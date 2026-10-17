import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { OTP_SEND_QUEUE } from '../src/modules/auth/otp-send.processor';
import request from 'supertest';
import { trustProxyFrom } from '../src/bootstrap';
import { CapturingChannel, createTestApp, randomPhone } from './helpers/test-app';

/**
 * CHORE-016 at the endpoint, through a proxy (ADR-0027). With TRUST_PROXY=1 the client is
 * the X-Forwarded-For address, so an attacker's requests cannot spend an administrator's
 * budget — and the admin door still answers identically for any number.
 */
describe('OTP budgets per client, behind a proxy (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  const OLD = process.env.TRUST_PROXY;

  beforeAll(async () => {
    process.env.TRUST_PROXY = '1';
    app = await createTestApp(new CapturingChannel());
  });

  afterAll(async () => {
    await app.close();
    process.env.TRUST_PROXY = OLD;
  });

  const ask = (phone: string, from: string) =>
    request(app.getHttpServer()).post('/auth/admin/otp/request').set('X-Forwarded-For', from).send({ phone });

  it('an attacker hammering a number does not lock its owner out', async () => {
    const phone = randomPhone();
    await ask(phone, '198.51.100.7').expect(200);
    await ask(phone, '198.51.100.7').expect(429);
    // The owner, on another connection, still gets a code.
    await ask(phone, '203.0.113.9').expect(200);
  });

  it('rotating addresses buys at most the per-phone ceiling', async () => {
    const phone = randomPhone();
    const statuses: number[] = [];
    for (let n = 1; n <= 11; n += 1) {
      statuses.push((await ask(phone, `192.0.2.${n}`)).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('TRUST_PROXY parses hop counts and lists, and refuses "trust everyone"', () => {
    expect(trustProxyFrom({})).toBeUndefined();
    expect(trustProxyFrom({ TRUST_PROXY: '0' })).toBeUndefined();
    expect(trustProxyFrom({ TRUST_PROXY: '1' })).toBe(1);
    expect(trustProxyFrom({ TRUST_PROXY: 'loopback, 10.0.0.0/8' })).toBe('loopback, 10.0.0.0/8');
    expect(() => trustProxyFrom({ TRUST_PROXY: 'true' })).toThrow(/X-Forwarded-For/);
  });

  it('the suite’s queues are namespaced away from a dev server on the same Redis (CHORE-017)', () => {
    // A `nest start --watch` dev server consumes every queue under the default `bull`
    // prefix — it was taking this suite's OTP sends.
    const queue = app.get<Queue>(getQueueToken(OTP_SEND_QUEUE));
    expect(queue.opts.prefix).toBe('bull-test');
  });
});
