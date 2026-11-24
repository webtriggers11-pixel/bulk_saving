import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Society } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ErrorCode } from '../src/common/error-codes';
import { INVITE_CHECK_FAIL_MAX, InviteCheckService } from '../src/modules/auth/invite-check.service';
import { CapturingChannel, createTestApp, randomInviteCode } from './helpers/test-app';

/**
 * FEAT-045 (ADR-0052): `POST /auth/invite/check` — the invite step's pre-check. Needs
 * Postgres + Redis. Every request here comes from the loopback address, so the one budget
 * key this file spends is cleared around each test.
 */
describe('POST /auth/invite/check (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let channel: CapturingChannel;
  let active: Society;
  let inactive: Society;
  const failKey = InviteCheckService.failKey('127.0.0.1');

  /** A well-formed code no society has. */
  async function unknownCode(): Promise<string> {
    for (;;) {
      const code = randomInviteCode();
      if (!(await prisma.society.findUnique({ where: { inviteCode: code } }))) return code;
    }
  }

  const check = (inviteCode: unknown) =>
    request(app.getHttpServer()).post('/auth/invite/check').send({ inviteCode });

  beforeAll(async () => {
    channel = new CapturingChannel();
    app = await createTestApp(channel);
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    active = await prisma.society.create({ data: { name: 'Check Active', city: 'Pune', inviteCode: randomInviteCode() } });
    inactive = await prisma.society.create({
      data: { name: 'Check Inactive', city: 'Pune', inviteCode: randomInviteCode(), active: false },
    });
  });

  beforeEach(async () => {
    await redis.del(failKey);
    channel.lastCode = null;
  });

  afterAll(async () => {
    await redis.del(failKey);
    await prisma.society.deleteMany({ where: { id: { in: [active.id, inactive.id] } } });
    await app.close();
  });

  it("an active society's code → 200 { valid: true }, nothing else, nothing sent", async () => {
    const res = await check(active.inviteCode).expect(200);
    expect(res.body).toEqual({ success: true, data: { valid: true } });
    expect(channel.lastCode).toBeNull();
  });

  it('an unknown code → 400 INVALID_INVITE_CODE "This is an invalid invite code."', async () => {
    const res = await check(await unknownCode()).expect(400);
    expect(res.body).toEqual({
      success: false,
      error: { code: ErrorCode.INVALID_INVITE_CODE, message: 'This is an invalid invite code.' },
    });
  });

  it("an inactive society's code answers exactly like an unknown one (ADR-0045 §4)", async () => {
    const off = await check(inactive.inviteCode).expect(400);
    const unknown = await check(await unknownCode()).expect(400);
    expect(off.body).toEqual(unknown.body);
  });

  it('a malformed code never reaches the lookup → 400 naming inviteCode, and costs no budget', async () => {
    for (const bad of ['abc', 'ab12cd34', 'AB12CD345', '', 42]) {
      const res = await check(bad).expect(400);
      // The DTO refusal (the envelope's BAD_REQUEST); the web maps it by the field it names (BUG-021).
      expect(res.body.error.code).toBe(ErrorCode.BAD_REQUEST);
      expect(res.body.error.message).toMatch(/inviteCode/);
    }
    expect(await redis.get(failKey)).toBeNull();
  });

  it(`after ${INVITE_CHECK_FAIL_MAX} wrong codes → 429 INVITE_CHECK_RATE_LIMITED, even for a right code`, async () => {
    const wrong = await unknownCode();
    for (let i = 0; i < INVITE_CHECK_FAIL_MAX; i++) {
      await check(wrong).expect(400);
    }
    const limited = await check(wrong).expect(429);
    expect(limited.body.error.code).toBe(ErrorCode.INVITE_CHECK_RATE_LIMITED);
    // Past the cap the code is not even looked up, so a right guess cannot be found.
    const right = await check(active.inviteCode).expect(429);
    expect(right.body.error.code).toBe(ErrorCode.INVITE_CHECK_RATE_LIMITED);
    expect(Number(await redis.ttl(failKey))).toBeGreaterThan(0);
  });

  it('parallel wrong guesses cannot overshoot the cap (the reservation is atomic)', async () => {
    // Through the service: 30 parallel supertest requests against an unlistened server
    // reset each other's sockets, and this is about Redis, not HTTP.
    const service = app.get(InviteCheckService);
    const wrong = await unknownCode();
    const results = await Promise.all(
      Array.from({ length: INVITE_CHECK_FAIL_MAX + 10 }, () => service.check(wrong, '127.0.0.1')),
    );
    expect(results.filter((r) => r === 'INVALID')).toHaveLength(INVITE_CHECK_FAIL_MAX);
    expect(results.filter((r) => r === 'RATE_LIMITED')).toHaveLength(10);
  });

  it('right codes are never counted, so residents sharing one network are not blocked by each other', async () => {
    for (let i = 0; i < INVITE_CHECK_FAIL_MAX + 5; i++) {
      await check(active.inviteCode).expect(200);
    }
    expect(Number((await redis.get(failKey)) ?? '0')).toBe(0);
    await check(await unknownCode()).expect(400);
    expect(await redis.get(failKey)).toBe('1');
  });

  it('a budget key that lost its TTL gets one back on the next miss (never a permanent lock)', async () => {
    await redis.set(failKey, '3');
    expect(await redis.ttl(failKey)).toBe(-1);
    await check(await unknownCode()).expect(400);
    expect(await redis.ttl(failKey)).toBeGreaterThan(0);
  });
});
