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

  /**
   * The admin door dispatches WITHOUT awaiting (ADR-0023, V2 round 2 P1-A), so the
   * response can land before the SMS does. Tests that need the code wait for it here
   * rather than reading `lastCode` off a race.
   */
  async function waitForSend(from: number): Promise<string> {
    for (let i = 0; i < 100; i += 1) {
      if (channel.sends > from) return channel.lastCode as string;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`no OTP dispatched within 1s (sends stayed at ${from})`);
  }

  it('signs an admin in with a phone number and nothing else (AC1, AC3)', async () => {
    const phone = await makeAdmin();

    const sendsBefore = channel.sends;
    const requested = await server()
      .post('/auth/admin/otp/request')
      .send({ phone })
      .expect(200);
    expect(requested.body).toEqual({ success: true, data: { requested: true } });

    const code = await waitForSend(sendsBefore);
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

  /**
   * AC2, and the property ADR-0023 spends most of its words on.
   *
   * The first version of this test compared response BODIES and passed while the
   * endpoint was a perfect oracle: a non-admin returned before the rate limiter ran,
   * so a second request inside 30s answered 429 for an administrator and 200 for
   * everyone else (V2 P1-1). Parity is therefore asserted on the full observable
   * answer — status AND body — across two requests, which is what an attacker has.
   */
  it('is indistinguishable across admin, resident and stranger — status and body (AC2)', async () => {
    const residentPhone = randomPhone();
    await prisma.resident.create({
      data: { societyId: society.id, phone: residentPhone, role: 'RESIDENT' },
    });
    const strangerPhone = randomPhone();
    const adminPhone = await makeAdmin();

    /** What an unauthenticated caller can actually see: two requests in a row. */
    async function probe(phone: string) {
      const first = await server().post('/auth/admin/otp/request').send({ phone });
      const second = await server().post('/auth/admin/otp/request').send({ phone });
      return {
        statuses: [first.status, second.status],
        bodies: [first.body, second.body],
      };
    }

    const sendsBefore = channel.sends;
    const asAdmin = await probe(adminPhone);
    const asResident = await probe(residentPhone);
    const asStranger = await probe(strangerPhone);

    expect(asResident).toEqual(asAdmin);
    expect(asStranger).toEqual(asAdmin);
    // Both probes consumed the limiter, so the SECOND request is refused for everyone.
    expect(asAdmin.statuses).toEqual([200, 429]);

    // The one thing that does differ is the only thing the caller cannot observe:
    // exactly one SMS was dispatched, to the administrator — and it is dispatched
    // off the response path, so it is awaited here rather than asserted inline.
    await waitForSend(sendsBefore);
    expect(channel.sends).toBe(sendsBefore + 1);
    expect(channel.lastPhone).toBe(adminPhone);
  });

  /**
   * V2 P1-2. `verify` used to answer OTP_INVALID for an unknown number and
   * OTP_EXPIRED for a registered one, so a single unauthenticated request revealed
   * whether a phone existed in the product.
   */
  it('gives the same refusal to a wrong code whoever sends it (AC2)', async () => {
    const residentPhone = randomPhone();
    await prisma.resident.create({
      data: { societyId: society.id, phone: residentPhone, role: 'RESIDENT' },
    });
    const strangerPhone = randomPhone();
    const adminPhone = await makeAdmin();

    async function guessWithoutRequesting(phone: string) {
      const res = await server().post('/auth/admin/otp/verify').send({ phone, code: '000000' });
      return { status: res.status, body: res.body };
    }

    const asAdmin = await guessWithoutRequesting(adminPhone);
    expect(await guessWithoutRequesting(residentPhone)).toEqual(asAdmin);
    expect(await guessWithoutRequesting(strangerPhone)).toEqual(asAdmin);

    // And once a code HAS been requested, the answer to a wrong guess is also the
    // same for all three — because the admin door stores one for everybody.
    async function requestThenGuess(phone: string) {
      await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
      const res = await server().post('/auth/admin/otp/verify').send({ phone, code: '000000' });
      return { status: res.status, body: res.body };
    }

    const guessedAdmin = await requestThenGuess(await makeAdmin());
    expect(await requestThenGuess(randomPhone())).toEqual(guessedAdmin);
    expect(guessedAdmin.body.error.code).toBe(ErrorCode.OTP_INVALID);
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
    const sendsBefore = channel.sends;
    await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
    const code = await waitForSend(sendsBefore);

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

  it('refuses a number that administers two societies, and sends it nothing', async () => {
    const phone = randomPhone();
    for (const societyId of [society.id, otherSociety.id]) {
      await prisma.resident.create({
        data: { societyId, phone, role: 'SUPER_ADMIN', verifiedAt: new Date() },
      });
    }

    const sendsBefore = channel.sends;
    await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
    // Ambiguous: there is no one society to sign them into, so nothing is sent.
    expect(channel.sends).toBe(sendsBefore);

    // ...and the request still consumed the limiter, exactly like every other number.
    await server().post('/auth/admin/otp/request').send({ phone }).expect(429);
  });

  /**
   * V2 (plausible finding): an administrator of one society who later joins another
   * through the resident door holds two rows with the same phone. Treating that as
   * ambiguous locked them out of the dashboard by way of using the product normally.
   */
  it('signs in an admin who is also a resident of another society', async () => {
    const phone = await makeAdmin();
    await prisma.resident.create({
      data: { societyId: otherSociety.id, phone, role: 'RESIDENT', verifiedAt: new Date() },
    });

    const sendsBefore = channel.sends;
    await server().post('/auth/admin/otp/request').send({ phone }).expect(200);
    const code = await waitForSend(sendsBefore);

    const res = await server().post('/auth/admin/otp/verify').send({ phone, code }).expect(200);
    // Signed into the society they ADMINISTER, not the one they merely live in.
    expect(res.body.data.resident.societyId).toBe(society.id);
    expect(res.body.data.resident.role).toBe('SUPER_ADMIN');
  });

  it('ignores a body that tries to name its own society or invite code (ADR-0003)', async () => {
    const phone = await makeAdmin();
    const sendsBefore = channel.sends;

    // The global pipe is `whitelist: true`, so these extra fields are stripped rather
    // than rejected — which is why the assertion that matters is about WHERE the
    // session landed, not about the status code.
    await server()
      .post('/auth/admin/otp/request')
      .send({ phone, societyId: otherSociety.id, inviteCode: otherSociety.inviteCode })
      .expect(200);
    const code = await waitForSend(sendsBefore);

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

  /**
   * V2 round 2, P1-A — at the ENDPOINT, not at the service.
   *
   * `OtpService`'s own spec proves the three dispatch modes behave differently; none
   * of it stops this controller from asking for the wrong one. Here the provider never
   * returns, so an awaited dispatch can never answer — and the request is RACED against
   * a timer rather than simply awaited, so that mutation fails in two seconds with a
   * readable message instead of hanging until the suite times out.
   */
  it('does not wait for the SMS provider before answering an admin (AC2)', async () => {
    let release: (() => void) | null = null;
    const hanging = new CapturingChannel();
    hanging.sendOtp = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });

    const hangingApp = await createTestApp(hanging);
    try {
      const phone = randomPhone();
      await hangingApp.get(PrismaService).resident.create({
        data: { societyId: society.id, phone, role: 'SUPER_ADMIN', verifiedAt: new Date() },
      });

      const responded = request(hangingApp.getHttpServer())
        .post('/auth/admin/otp/request')
        .send({ phone })
        .then((res) => res.status);
      const timedOut = new Promise<'TIMED_OUT'>((resolve) =>
        setTimeout(() => resolve('TIMED_OUT'), 2_000),
      );

      await expect(Promise.race([responded, timedOut])).resolves.toBe(200);
    } finally {
      (release as (() => void) | null)?.();
      await hangingApp.close();
    }
  }, 15_000);

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
