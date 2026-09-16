import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Tenant isolation (T8) — the most important correctness test. A resident
 * authenticated in Society A must NOT be able to read a resident belonging to
 * Society B. Needs DB + Redis.
 */
describe('Tenant isolation (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let societyA: Society;
  let societyB: Society;
  let residentA: Resident;
  let residentB: Resident;
  let tokenA: string;

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    societyA = await prisma.society.create({
      data: { name: 'Society A', city: 'Pune', inviteCode: randomInviteCode() },
    });
    societyB = await prisma.society.create({
      data: { name: 'Society B', city: 'Mumbai', inviteCode: randomInviteCode() },
    });
    residentA = await prisma.resident.create({
      data: { societyId: societyA.id, phone: randomPhone(), verifiedAt: new Date() },
    });
    residentB = await prisma.resident.create({
      data: { societyId: societyB.id, phone: randomPhone(), verifiedAt: new Date() },
    });
    tokenA = (await auth.issueTokens(residentA)).accessToken;
  });

  afterAll(async () => {
    await prisma.society.deleteMany({ where: { id: { in: [societyA.id, societyB.id] } } });
    await app.close();
  });

  it('lets a resident read their OWN record', async () => {
    const res = await request(app.getHttpServer())
      .get(`/residents/${residentA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.data.id).toBe(residentA.id);
    expect(res.body.data.societyId).toBe(societyA.id);
  });

  it("DENIES reading a resident from another society (cross-tenant)", async () => {
    // residentB genuinely exists, but is invisible to a Society A caller.
    const exists = await prisma.resident.findUnique({ where: { id: residentB.id } });
    expect(exists).not.toBeNull();

    const res = await request(app.getHttpServer())
      .get(`/residents/${residentB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
    expect(res.body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('scopes /me strictly to the caller own society', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.data.society.id).toBe(societyA.id);
    expect(res.body.data.society.id).not.toBe(societyB.id);
  });
});
