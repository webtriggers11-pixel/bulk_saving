import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Resident, Society } from '@prisma/client';
import type { AdminOverviewDto } from '@bulk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { CapturingChannel, createTestApp, randomInviteCode, randomPhone } from './helpers/test-app';

/** `GET /admin/overview` (FEAT-034): counts + newest societies and users. The DB is shared, so counts are checked relatively. */
describe('Admin overview API (integration, needs DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let society: Society;
  let admin: Resident;
  let adminToken: string;
  let residentToken: string;

  beforeAll(async () => {
    app = await createTestApp(new CapturingChannel());
    prisma = app.get(PrismaService);
    const auth = app.get(AuthService);
    society = await prisma.society.create({ data: { name: `Overview ${randomInviteCode()}`, city: 'Pune', inviteCode: randomInviteCode() } });
    admin = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'SUPER_ADMIN', verifiedAt: new Date() } });
    const resident = await prisma.resident.create({ data: { societyId: society.id, phone: randomPhone(), role: 'RESIDENT', verifiedAt: new Date() } });
    adminToken = (await auth.issueTokens(admin)).accessToken;
    residentToken = (await auth.issueTokens(resident)).accessToken;
  });

  afterAll(async () => {
    await prisma.society.delete({ where: { id: society.id } });
    await app.close();
  });

  it('a resident gets 403', async () => {
    await request(app.getHttpServer()).get('/admin/overview').set('Authorization', `Bearer ${residentToken}`).expect(403);
  });

  it('counts the platform and lists the newest societies and users (at most 5 each, newest first)', async () => {
    const res = await request(app.getHttpServer()).get('/admin/overview').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const o = res.body.data as AdminOverviewDto;
    expect(o.societies).toBeGreaterThanOrEqual(1);
    expect(o.users).toBeGreaterThanOrEqual(2);
    expect(o.admins).toBeGreaterThanOrEqual(1);
    expect(o.openRounds).toBeGreaterThanOrEqual(0);
    expect(o.recentSocieties.length).toBeLessThanOrEqual(5);
    expect(o.recentUsers.length).toBeLessThanOrEqual(5);
    const times = o.recentUsers.map((u) => Date.parse(u.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(o.recentSocieties[0]).toHaveProperty('residentCount');
    expect(o.recentUsers[0]).toHaveProperty('society.name');
  });
});
