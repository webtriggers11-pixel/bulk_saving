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
 * FEAT-012 — the admin door: phone and code, no invite code (ADR-0023). Needs
 * Postgres + Redis (`docker compose up -d`).
 *
 * The properties under test are as much about what this endpoint pair does NOT do —
 * reveal who is an admin, create a resident, or accept a society from the caller — as
 * about the happy path.
 */
describe('Admin sign-in (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let channel: CapturingChannel;
  let society: Society;
  let otherSociety: Society;

  beforeAll(async () => {
    channel = new CapturingChannel();
    app = await createTestApp(channel);
    prisma = app.get(PrismaService);
    society = await prisma.society.create({
      data: { name: 'Green Meadows', city: 'Pune', inviteCode: randomInviteCode() },
    });
    otherSociety = await prisma.society.create({
      data: { name: 'Blue Waters', city: 'Mumbai', inviteCode: randomInviteCode() },
    });
  });

  afterAll(async () => {
    await prisma.resident.deleteMany({
      where: { societyId: { in: [society.id, otherSociety.id] } },
    });
    await prisma.society.deleteMany({ where: { id: { in: [society.id, otherSociety.id] } } });
    await app.close();
  });

  /** An admin with a fresh number, so rate limits never collide between tests. */
  async function makeAdmin(societyId = society.id) {
    const phone = randomPhone();
    await prisma.resident.create({
      data: { societyId, phone, name: 'Admin', role: 'SUPER_ADMIN', verifiedAt: new Date() },
    });
    return phone;
  }

  const server = () => request(app.getHttpServer());

  it('signs an admin in with a phone number and nothing else (AC1, AC3)', async () => {
    const phone = await makeAdmin();

    const requested = await server()
      .post('/auth/admin/otp/request')
      .send({ phone })
      .expect(200);
    expect(requested.body).toEqual({ success: true, data: { requested: true } });

    const code = channel.lastCode as string;
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(requested.body)).not.toContain(code);

    const verified = await server()
      .post('/auth/admin/otp/verify')
      .send({ phone, code })
      .expect(200);

    const { accessToken, resident } = verified.body.data;
    expect(resident.role).toBe('SUPER_ADMIN');
    // AC3: the society came from the admin's own row — nothing in the request named it.
    expect(resident.societyId).toBe(society.id);
    expect(JSON.stringify(verified.body)).not.toContain(code);

    // The session it mints is an ordinary one, and it works.
    const me = await server()
      .get('/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.data.society.id).toBe(society.id);
  });

  it('answers identically for a number that is not an admin, and sends nothing (AC2)', async () => {
    const residentPhone = randomPhone();
    await prisma.resident.create({
      data: { societyId: society.id, phone: residentPhone, role: 'RESIDENT' },
    });
    const strangerPhone = randomPhone();
    const adminPhone = await makeAdmin();

    const sendsBefore = channel.sends;

    const asResident = await server()
      .post('/auth/admin/otp/request')
      .send({ phone: residentPhone })
      .expect(200);
    const asStranger = await server()
      .post('/auth/admin/otp/request')
      .send({ phone: strangerPhone })
      .expect(200);
    // Nothing was dispatched for either.
    expect(channel.sends).toBe(sendsBefore);

    const asAdmin = await server()
      .post('/auth/admin/otp/request')
      .send({ phone: adminPhone })
      .expect(200);
    expect(channel.sends).toBe(sendsBefore + 1);

    // The three responses are indistinguishable — that IS the acceptance criterion.
    expect(asResident.body).toEqual(asAdmin.body);
    expect(asStranger.body).toEqual(asAdmin.body);
  });

  it('never creates a resident, however the admin door is poked (AC4)', async () => {
    const unknown = randomPhone();
    const before = await prisma.resident.count();

    await server().post('/auth/admin/otp/request').send({ phone: unknown }).expect(200);
    const verify = await server()
      .post('/auth/admin/otp/verify')
      .send({ phone: unknown, code: '123456' })
      .expect(400);
    expect(verify.body.error.code).toBe(ErrorCode.OTP_INVALID);

    expect(await prisma.resident.count()).toBe(before);
    expect(await prisma.resident.findFirst({ where: { phone: unknown } })).toBeNull();
  });

  it('refuses a valid code from a number that is no longer an admin (AC5)', async () => {
    const phone = await makeAdmin();
    await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
    const code = channel.lastCode as string;

    // Demoted between requesting the code and using it — the role is an authorisation
    // decision, so it is read at the moment it is acted on, not when the OTP was sent.
    await prisma.resident.updateMany({ where: { phone }, data: { role: 'RESIDENT' } });

    const res = await server()
      .post('/auth/admin/otp/verify')
      .send({ phone, code })
      .expect(403);
    expect(res.body.error.code).toBe(ErrorCode.NOT_AN_ADMIN);
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('accessToken');
  });

  it('refuses a number that holds a row in two societies (ADR-0023)', async () => {
    const phone = randomPhone();
    await prisma.resident.create({
      data: { societyId: society.id, phone, role: 'SUPER_ADMIN', verifiedAt: new Date() },
    });
    await prisma.resident.create({
      data: { societyId: otherSociety.id, phone, role: 'SUPER_ADMIN', verifiedAt: new Date() },
    });

    const sendsBefore = channel.sends;
    await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
    // Ambiguous scope: nothing is sent, because there is no one society to send it for.
    expect(channel.sends).toBe(sendsBefore);

    const res = await server()
      .post('/auth/admin/otp/verify')
      .send({ phone, code: '123456' })
      .expect(400);
    expect(res.body.error.code).toBe(ErrorCode.OTP_INVALID);
  });

  it('ignores a body that tries to name its own society or invite code (ADR-0003)', async () => {
    const phone = await makeAdmin();

    // The global pipe is `whitelist: true`, so these extra fields are stripped rather
    // than rejected — which is why the assertion that matters is about WHERE the
    // session landed, not about the status code.
    await server()
      .post('/auth/admin/otp/request')
      .send({ phone, societyId: otherSociety.id, inviteCode: otherSociety.inviteCode })
      .expect(200);
    const code = channel.lastCode as string;

    const res = await server()
      .post('/auth/admin/otp/verify')
      .send({ phone, code, societyId: otherSociety.id, inviteCode: otherSociety.inviteCode })
      .expect(200);

    // Both requests named Blue Waters. The session is in Green Meadows, because that is
    // what the admin's row says and the body is not consulted.
    expect(res.body.data.resident.societyId).toBe(society.id);
    expect(res.body.data.resident.societyId).not.toBe(otherSociety.id);
  });

  it('applies the 1-per-30s resend limit to the admin door too (AC10)', async () => {
    const phone = await makeAdmin();

    await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
    const second = await server()
      .post('/auth/admin/otp/request')
      .send({ phone })
      .expect(429);
    expect(second.body.error.code).toBe(ErrorCode.OTP_RATE_LIMITED);
  });

  it('leaves the resident door exactly as it was (AC6)', async () => {
    const phone = randomPhone();

    // Still requires an invite code...
    await server().post('/auth/otp/request').send({ phone }).expect(400);

    // ...and still creates the resident on first verify, which the admin door must not.
    await server()
      .post('/auth/otp/request')
      .send({ inviteCode: society.inviteCode, phone })
      .expect(200);
    const code = channel.lastCode as string;
    const res = await server()
      .post('/auth/otp/verify')
      .send({ inviteCode: society.inviteCode, phone, code, name: 'Asha' })
      .expect(200);
    expect(res.body.data.resident.name).toBe('Asha');
    expect(res.body.data.resident.role).toBe('RESIDENT');
  });
});
