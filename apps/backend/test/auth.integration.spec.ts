import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Society } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ErrorCode } from '../src/common/error-codes';
import {
  CapturingChannel,
  createTestApp,
  randomInviteCode,
  randomPhone,
} from './helpers/test-app';

/**
 * OTP → auth happy path + invalid invite code (T6). Needs Postgres + Redis
 * (`docker compose up -d`). The OTP is recovered ONLY through the capturing
 * channel — it is asserted to never appear in any API response.
 */
describe('Auth OTP flow (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let channel: CapturingChannel;
  let society: Society;

  beforeAll(async () => {
    channel = new CapturingChannel();
    app = await createTestApp(channel);
    prisma = app.get(PrismaService);
    society = await prisma.society.create({
      data: { name: 'Green Meadows', city: 'Pune', inviteCode: randomInviteCode() },
    });
  });

  afterAll(async () => {
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
  });

  it('request → verify issues tokens and never leaks the OTP', async () => {
    const phone = randomPhone();

    const reqRes = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ inviteCode: society.inviteCode, phone })
      .expect(200);

    expect(reqRes.body).toEqual({ success: true, data: { requested: true } });
    expect(JSON.stringify(reqRes.body)).not.toContain(channel.lastCode as string);
    expect(channel.lastCode).toMatch(/^\d{6}$/);

    const code = channel.lastCode as string;
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ inviteCode: society.inviteCode, phone, code, name: 'Asha' })
      .expect(200);

    expect(verifyRes.body.success).toBe(true);
    const { accessToken, refreshToken, resident } = verifyRes.body.data;
    expect(typeof accessToken).toBe('string');
    expect(typeof refreshToken).toBe('string');
    expect(resident.societyId).toBe(society.id);
    expect(resident.name).toBe('Asha');
    expect(resident.verifiedAt).not.toBeNull();
    // No OTP field anywhere in the verify response.
    expect(JSON.stringify(verifyRes.body)).not.toContain(code);

    // The issued access token works against a guarded endpoint.
    const meRes = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.data.resident.id).toBe(resident.id);
    expect(meRes.body.data.society.id).toBe(society.id);

    // Refresh rotates; the old refresh token is then rejected.
    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(refreshRes.body.data.refreshToken).not.toBe(refreshToken);

    const reuse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    expect(reuse.body.error.code).toBe(ErrorCode.TOKEN_REVOKED);
  });

  it('rejects an unknown invite code and sends no OTP', async () => {
    const before = channel.sends;
    const res = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ inviteCode: 'ZZZZZZZZ', phone: randomPhone() })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ErrorCode.INVALID_INVITE_CODE);
    expect(channel.sends).toBe(before);
  });

  it('rejects a malformed body via DTO validation', async () => {
    await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ inviteCode: 'short', phone: 'nope' })
      .expect(400);
  });

  describe('the OTP never crosses the API boundary (CHORE-007, ADR-0020)', () => {
    const OLD_FLAG = process.env.OTP_DEV_LOG;

    afterEach(() => {
      process.env.OTP_DEV_LOG = OLD_FLAG;
    });

    it('returns only the acknowledgement, whatever the dev flag says', async () => {
      // CHORE-002 briefly returned the code here so the web app could show it in a
      // toast. CHORE-007 removed that: the affordance moved into the stub SMS channel
      // (a short-TTL Redis key), which a real provider replaces wholesale — so the
      // production auth path has no bypass to reason about at all.
      for (const flag of ['true', 'false']) {
        process.env.OTP_DEV_LOG = flag;
        const res = await request(app.getHttpServer())
          .post('/auth/otp/request')
          .send({ inviteCode: society.inviteCode, phone: randomPhone() })
          .expect(200);

        expect(res.body.data).toEqual({ requested: true });
        expect(JSON.stringify(res.body)).not.toMatch(/devCode/);
      }
    });

    it('still delivers a usable code through the channel', async () => {
      // The route stops leaking, but login must still work: the code reaches the
      // channel, which is the only path out of OtpService.
      const phone = randomPhone();
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ inviteCode: society.inviteCode, phone })
        .expect(200);

      expect(channel.lastCode).toMatch(/^\d{6}$/);
      await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ inviteCode: society.inviteCode, phone, code: channel.lastCode as string })
        .expect(200);
    });
  });
});
