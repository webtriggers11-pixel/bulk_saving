import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Society } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { ErrorCode } from '../src/common/error-codes';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/**
 * Role guard (T7): GET /admin/ping is SUPER_ADMIN only. Needs DB + Redis.
 */
describe('Role guard on /admin/ping (integration, needs DB + Redis)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let society: Society;
  let residentToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);

    society = await prisma.society.create({
      data: { name: 'Role Society', city: 'Pune', inviteCode: randomInviteCode() },
    });
    const resident = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() },
    });
    const admin = await prisma.resident.create({
      data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() },
    });
    residentToken = (await auth.issueTokens(resident)).accessToken;
    adminToken = (await auth.issueTokens(admin)).accessToken;
  });

  afterAll(async () => {
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
  });

  it('denies a RESIDENT token with 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/ping')
      .set('Authorization', `Bearer ${residentToken}`)
      .expect(403);
    expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('allows a SUPER_ADMIN token with 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/ping')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual({ success: true, data: { pong: true } });
  });

  it('rejects a missing token with 401', async () => {
    const res = await request(app.getHttpServer()).get('/admin/ping').expect(401);
    expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });
});
